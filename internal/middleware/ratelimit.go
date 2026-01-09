package middleware

import (
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

func clientIP(r *http.Request) string {
	// якщо є проксі (Render/Nginx) — беремо реальний IP
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		ip := strings.TrimSpace(parts[0])
		if ip != "" {
			return ip
		}
	}
	if rip := strings.TrimSpace(r.Header.Get("X-Real-IP")); rip != "" {
		return rip
	}

	// fallback
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	return strings.TrimSpace(r.RemoteAddr)
}

// RateLimitPerIP: ліміт на IP (захист від brute-force / spam)
func RateLimitPerIP(rps float64, burst int) func(http.Handler) http.Handler {
	var (
		mu       sync.Mutex
		visitors = make(map[string]*visitor)
	)

	// cleanup “старих” IP (щоб map не ріс вічно)
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			mu.Lock()
			for ip, v := range visitors {
				if time.Since(v.lastSeen) > 3*time.Minute {
					delete(visitors, ip)
				}
			}
			mu.Unlock()
		}
	}()

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := clientIP(r)

			mu.Lock()
			v, ok := visitors[ip]
			if !ok {
				v = &visitor{
					limiter: rate.NewLimiter(rate.Limit(rps), burst),
				}
				visitors[ip] = v
			}
			v.lastSeen = time.Now()
			lim := v.limiter
			mu.Unlock()

			if !lim.Allow() {
				w.Header().Set("Content-Type", "text/plain; charset=utf-8")
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = w.Write([]byte("Too many requests, try again later"))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
