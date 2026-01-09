package middleware

import (
	"errors"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// TrustedProxyChecker визначає, чи можна довіряти X-Forwarded-For / X-Real-IP
type TrustedProxyChecker interface {
	IsTrusted(ip net.IP) bool
}

type cidrTrust struct {
	nets []*net.IPNet
}

func (c cidrTrust) IsTrusted(ip net.IP) bool {
	if ip == nil {
		return false
	}
	for _, n := range c.nets {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

// NewCIDRTrust створює список trusted proxy з CIDR-рядків
// приклад CIDR: "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"
func NewCIDRTrust(cidrs []string) (TrustedProxyChecker, error) {
	var nets []*net.IPNet
	for _, s := range cidrs {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		_, n, err := net.ParseCIDR(s)
		if err != nil {
			return nil, err
		}
		nets = append(nets, n)
	}
	return cidrTrust{nets: nets}, nil
}

// -------- IP helpers --------

func parseRemoteIP(remoteAddr string) net.IP {
	remoteAddr = strings.TrimSpace(remoteAddr)
	if remoteAddr == "" {
		return nil
	}

	host, _, err := net.SplitHostPort(remoteAddr)
	if err == nil {
		return net.ParseIP(strings.TrimSpace(host))
	}

	// інколи може бути без порта
	return net.ParseIP(remoteAddr)
}

func firstValidIPFromXFF(xff string) (net.IP, error) {
	if xff == "" {
		return nil, errors.New("empty xff")
	}
	parts := strings.Split(xff, ",")
	for _, p := range parts {
		ip := net.ParseIP(strings.TrimSpace(p))
		if ip != nil {
			return ip, nil
		}
	}
	return nil, errors.New("no valid ip in xff")
}

func clientIP(r *http.Request, trust TrustedProxyChecker) string {
	remoteIP := parseRemoteIP(r.RemoteAddr)

	// ДОВІРЯЄМО заголовкам тільки якщо запит прийшов від trusted proxy
	if trust != nil && trust.IsTrusted(remoteIP) {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			if ip, err := firstValidIPFromXFF(xff); err == nil {
				return ip.String()
			}
		}
		if rip := strings.TrimSpace(r.Header.Get("X-Real-IP")); rip != "" {
			if ip := net.ParseIP(rip); ip != nil {
				return ip.String()
			}
		}
	}

	// fallback: RemoteAddr
	if remoteIP != nil {
		return remoteIP.String()
	}

	// як зовсім крайній випадок
	return strings.TrimSpace(r.RemoteAddr)
}

// RateLimitPerIP: ліміт на IP (захист від brute-force / spam)
// trust - список trusted proxy (CIDR), щоб безпечно використовувати XFF/X-Real-IP
func RateLimitPerIP(rps float64, burst int, trust TrustedProxyChecker) func(http.Handler) http.Handler {
	var (
		mu       sync.Mutex
		visitors = make(map[string]*visitor)
	)

	// cleanup старих IP
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			cutoff := time.Now().Add(-3 * time.Minute)
			mu.Lock()
			for ip, v := range visitors {
				if v.lastSeen.Before(cutoff) {
					delete(visitors, ip)
				}
			}
			mu.Unlock()
		}
	}()

	limRate := rate.Limit(rps)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := clientIP(r, trust)

			mu.Lock()
			v, ok := visitors[ip]
			if !ok {
				v = &visitor{
					limiter: rate.NewLimiter(limRate, burst),
				}
				visitors[ip] = v
			}
			v.lastSeen = time.Now()
			lim := v.limiter
			mu.Unlock()

			if !lim.Allow() {
				w.Header().Set("Content-Type", "text/plain; charset=utf-8")
				w.Header().Set("Retry-After", "2")
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = w.Write([]byte("Too many requests, try again later"))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
