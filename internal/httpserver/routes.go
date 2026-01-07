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
	meHandler *handlers.MeHandler,
	jwtService *services.JWTService,
) {
	// public
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/auth/register", authHandler.Register)
	mux.HandleFunc("/auth/login", authHandler.Login)
	mux.Handle("/swagger/", httpSwagger.WrapHandler)

	// protected
	mux.Handle("/profile", middleware.AuthMiddleware(jwtService)(http.HandlerFunc(handlers.Profile)))
	mux.Handle("/me", middleware.AuthMiddleware(jwtService)(http.HandlerFunc(meHandler.Me)))
	mux.Handle("/plan/select", middleware.AuthMiddleware(jwtService)(http.HandlerFunc(meHandler.SelectPlan)))
}
