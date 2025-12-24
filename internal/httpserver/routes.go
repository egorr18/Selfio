package httpserver

import (
	"net/http"

	"backend/internal/handlers"
)

func registerRoutes(
	mux *http.ServeMux,
	authHandler *handlers.AuthHandler,
) {
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/auth/register", authHandler.Register)
	mux.HandleFunc("/auth/login", authHandler.Login)
}
