package httpserver

import (
	"net/http"

	"backend/internal/handlers"
	"backend/internal/middleware"
	"backend/internal/services"
	"github.com/swaggo/http-swagger"
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
	mux.Handle("/swagger/", httpSwagger.WrapHandler)

	// protected
	protected := http.NewServeMux()
	protected.HandleFunc("/profile", handlers.Profile)

	mux.Handle(
		"/profile",
		middleware.AuthMiddleware(jwtService)(protected),
	)
}
