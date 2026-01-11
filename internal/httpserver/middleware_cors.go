package httpserver

import (
	"net/http"
	"strings"
)

func corsMiddleware(allowedOrigins []string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		o = strings.TrimSpace(o)
		if o != "" {
			allowed[o] = struct{}{}
		}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			// Якщо це не браузер (curl/psql/etc) — Origin нема, пропускаємо без CORS заголовків
			if origin != "" {
				if _, ok := allowed[origin]; ok {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Set("Vary", "Origin")
					w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
					w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
					// Тобі не треба cookies → тому credentials не включаємо
					// w.Header().Set("Access-Control-Allow-Credentials", "true")

					if r.Method == http.MethodOptions {
						w.WriteHeader(http.StatusNoContent)
						return
					}
				} else {
					// Є Origin, але він НЕ дозволений → одразу блокуємо (інакше буде “занадто відкрито”)
					http.Error(w, "CORS blocked", http.StatusForbidden)
					return
				}
			} else if r.Method == http.MethodOptions {
				// preflight без Origin — рідко, але хай буде
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
