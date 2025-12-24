package httpserver

import "net/http"

func registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/health", healthHandler)
}
