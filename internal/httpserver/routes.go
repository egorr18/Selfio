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

	loginLimiter := middleware.RateLimitPerIP(1, 5) // ~1 req/sec, burst 5
	regLimiter := middleware.RateLimitPerIP(0.3, 3) // ~1 req/3 sec, burst 3

	mux.Handle("/auth/login", loginLimiter(http.HandlerFunc(authHandler.Login)))
	mux.Handle("/auth/register", regLimiter(http.HandlerFunc(authHandler.Register)))

	mux.Handle("/swagger/", httpSwagger.WrapHandler)

	// protected
	mux.Handle("/profile", middleware.AuthMiddleware(jwtService)(http.HandlerFunc(handlers.Profile)))
	mux.Handle("/me", middleware.AuthMiddleware(jwtService)(http.HandlerFunc(meHandler.Me)))
	mux.Handle("/plan/select", middleware.AuthMiddleware(jwtService)(http.HandlerFunc(meHandler.SelectPlan)))
}
