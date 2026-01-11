package httpserver

import (
	"net/http"
	"strings"
)

// Render термінує TLS на edge і прокидує X-Forwarded-Proto=https
func HTTPSOnlyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// health хай проходить завжди, щоб не зламати перевірки
		if r.URL.Path == "/health" {
			next.ServeHTTP(w, r)
			return
		}

		// local dev — ok по http
		if strings.HasPrefix(r.Host, "localhost") || strings.HasPrefix(r.Host, "127.0.0.1") {
			next.ServeHTTP(w, r)
			return
		}

		xfp := strings.ToLower(strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")))
		if xfp == "https" || r.TLS != nil {
			next.ServeHTTP(w, r)
			return
		}

		// якщо прийшло без https — редіректимо
		target := "https://" + r.Host + r.URL.RequestURI()
		http.Redirect(w, r, target, http.StatusPermanentRedirect)
	})
}
