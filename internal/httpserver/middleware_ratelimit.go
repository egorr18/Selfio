package httpserver

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type RateLimitConfig struct {
	GlobalRPS   float64
	GlobalBurst int
	AuthRPS     float64
	AuthBurst   int
}

type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type rateLimiterStore struct {
	mu    sync.Mutex
	store map[string]*visitor

	globalRPS   rate.Limit
	globalBurst int
	authRPS     rate.Limit
	authBurst   int
}

func newRateLimiterStore(cfg RateLimitConfig) *rateLimiterStore {
	s := &rateLimiterStore{
		store:       make(map[string]*visitor),
		globalRPS:   rate.Limit(cfg.GlobalRPS),
		globalBurst: cfg.GlobalBurst,
		authRPS:     rate.Limit(cfg.AuthRPS),
		authBurst:   cfg.AuthBurst,
	}

	// cleanup старих IP (щоб мапа не росла)
	go func() {
		ticker := time.NewTicker(2 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			s.mu.Lock()
			for ip, v := range s.store {
				if time.Since(v.lastSeen) > 10*time.Minute {
					delete(s.store, ip)
				}
			}
			s.mu.Unlock()
		}
	}()

	return s
}

func (s *rateLimiterStore) getLimiter(ip string, auth bool) *rate.Limiter {
	s.mu.Lock()
	defer s.mu.Unlock()

	v, ok := s.store[ip]
	if !ok {
		var lim *rate.Limiter
		if auth {
			lim = rate.NewLimiter(s.authRPS, s.authBurst)
		} else {
			lim = rate.NewLimiter(s.globalRPS, s.globalBurst)
		}
		s.store[ip] = &visitor{limiter: lim, lastSeen: time.Now()}
		return lim
	}

	v.lastSeen = time.Now()
	return v.limiter
}

func getClientIP(r *http.Request) string {
	// Render/проксі часто ставить X-Forwarded-For
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			ip := strings.TrimSpace(parts[0])
			if ip != "" {
				return ip
			}
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}

func rateLimitMiddleware(cfg RateLimitConfig) func(http.Handler) http.Handler {
	store := newRateLimiterStore(cfg)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// не лімітуємо preflight і health
			if r.Method == http.MethodOptions || r.URL.Path == "/health" {
				next.ServeHTTP(w, r)
				return
			}

			ip := getClientIP(r)
			isAuth := r.URL.Path == "/auth/login" || r.URL.Path == "/auth/register"

			lim := store.getLimiter(ip, isAuth)
			if !lim.Allow() {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				_ = json.NewEncoder(w).Encode(map[string]any{
					"error":   "rate_limited",
					"message": "Too many requests. Please slow down.",
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
