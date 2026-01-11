package httpserver

import (
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type rlCounter struct {
	windowStart time.Time
	count       int
	lastSeen    time.Time
}

type rateLimiter struct {
	mu          sync.Mutex
	clients     map[string]*rlCounter
	lastCleanup time.Time
}

func newRateLimiter() *rateLimiter {
	return &rateLimiter{
		clients:     make(map[string]*rlCounter),
		lastCleanup: time.Now(),
	}
}

// обмеження (можеш підкрутити)
const (
	windowGeneral = time.Minute
	limitGeneral  = 240 // ~4 req/sec в середньому

	windowAuth = time.Minute
	limitAuth  = 20 // логін/реєстрація — більш жорстко

	cleanupEvery   = 5 * time.Minute
	forgetClientIn = 15 * time.Minute
)

func (rl *rateLimiter) allow(key string, window time.Duration, limit int) (allowed bool, retryAfterSec int) {
	now := time.Now()

	rl.mu.Lock()
	defer rl.mu.Unlock()

	// cleanup інколи
	if now.Sub(rl.lastCleanup) > cleanupEvery {
		for k, v := range rl.clients {
			if now.Sub(v.lastSeen) > forgetClientIn {
				delete(rl.clients, k)
			}
		}
		rl.lastCleanup = now
	}

	c, ok := rl.clients[key]
	if !ok {
		rl.clients[key] = &rlCounter{windowStart: now, count: 1, lastSeen: now}
		return true, 0
	}

	c.lastSeen = now

	// нове вікно
	if now.Sub(c.windowStart) >= window {
		c.windowStart = now
		c.count = 1
		return true, 0
	}

	// в межах вікна
	if c.count >= limit {
		remaining := window - now.Sub(c.windowStart)
		sec := int(remaining.Seconds())
		if sec < 1 {
			sec = 1
		}
		return false, sec
	}

	c.count++
	return true, 0
}

func clientIP(r *http.Request) string {
	// Render/Proxy часто ставить X-Forwarded-For
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
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

func isAuthPath(path string) bool {
	return strings.HasPrefix(path, "/auth/login") || strings.HasPrefix(path, "/auth/register")
}

func RateLimitMiddleware(next http.Handler) http.Handler {
	rl := newRateLimiter()

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// не лімітуємо preflight і health
		if r.Method == http.MethodOptions || r.URL.Path == "/health" {
			next.ServeHTTP(w, r)
			return
		}

		ip := clientIP(r)

		window := windowGeneral
		limit := limitGeneral
		if isAuthPath(r.URL.Path) {
			window = windowAuth
			limit = limitAuth
		}

		ok, retryAfter := rl.allow(ip, window, limit)
		if !ok {
			w.Header().Set("Retry-After", strconvItoaSafe(retryAfter))
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte("rate_limited"))
			return
		}

		next.ServeHTTP(w, r)
	})
}

// щоб не тягнути strconv заради 1 функції
func strconvItoaSafe(n int) string {
	if n <= 0 {
		return "1"
	}
	// дуже простий itoa
	buf := make([]byte, 0, 12)
	for n > 0 {
		d := n % 10
		buf = append([]byte{byte('0' + d)}, buf...)
		n /= 10
	}
	return string(buf)
}

func init() {
	log.Println("RateLimitMiddleware loaded")
}
