package httpserver

import (
	"net/http"
	"strings"
)

func enforceHTTPSMiddleware(appEnv string) func(http.Handler) http.Handler {
	env := strings.ToLower(strings.TrimSpace(appEnv))

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Локально не чіпаємо
			if env != "production" {
				next.ServeHTTP(w, r)
				return
			}

			// На Render TLS термінація на проксі, тому дивимось на X-Forwarded-Proto
			if proto := strings.ToLower(r.Header.Get("X-Forwarded-Proto")); proto != "" && proto != "https" {
				http.Error(w, "HTTPS required", http.StatusUpgradeRequired)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
