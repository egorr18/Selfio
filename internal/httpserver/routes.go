package httpserver

import (
	"net/http"

	"backend/internal/handlers"
	"backend/internal/middleware"
	"backend/internal/services"
)

func registerRoutes(
	mux *http.ServeMux,
	authHandler *handlers.AuthHandler,
	jwtService *services.JWTService,
) {
	// public
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/auth/register", authHandler.Register)
	mux.HandleFunc("/auth/login", authHandler.Login)

	// protected
	protected := http.NewServeMux()
	protected.HandleFunc("/profile", handlers.Profile)

	mux.Handle(
		"/profile",
		middleware.AuthMiddleware(jwtService)(protected),
	)
}
