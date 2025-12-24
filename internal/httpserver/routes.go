package httpserver

import (
	"net/http"

	"backend/internal/handlers"
)

func registerRoutes(
	mux *http.ServeMux,
	authHandler *handlers.AuthHandler,
) {
	// health
	mux.HandleFunc("/health", healthHandler)

	// auth
	mux.HandleFunc("/auth/register", authHandler.Register)
	mux.HandleFunc("/auth/login", authHandler.Login)
}
