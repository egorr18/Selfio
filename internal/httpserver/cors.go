package httpserver

import (
	"net/http"
	"strings"
)

func CorsMiddleware(next http.Handler) http.Handler {
	allowedOrigins := map[string]struct{}{
		"http://localhost:8080":     {},
		"http://127.0.0.1:8080":     {},
		"http://localhost:5500":     {},
		"http://127.0.0.1:5500":     {},
		"https://egorr18.github.io": {}, // GitHub Pages (ВАЖЛИВО: лише origin, без /Selfio)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimSpace(r.Header.Get("Origin"))

		// Якщо Origin нема — це не CORS-запит (наприклад, сервер-сервер або прямий перехід)
		if origin == "" {
			next.ServeHTTP(w, r)
			return
		}

		_, ok := allowedOrigins[origin]
		if !ok {
			// Якщо це preflight з чужого origin — явно блокуємо
			if r.Method == http.MethodOptions {
				http.Error(w, "CORS blocked", http.StatusForbidden)
				return
			}
			// Для звичайних запитів без CORS-хедерів браузер сам заблокує
			next.ServeHTTP(w, r)
			return
		}

		// Allowed origin → додаємо CORS headers
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Key")
		w.Header().Set("Access-Control-Max-Age", "600")

		// Preflight
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
