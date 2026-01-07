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
	protected := http.NewServeMux()

	// якщо /profile тобі ще треба — лишаємо
	protected.HandleFunc("/profile", handlers.Profile)

	// нові ендпоінти
	protected.HandleFunc("/me", meHandler.GetMe)
	protected.HandleFunc("/me/plan", meHandler.UpdatePlan)

	// важливо: щоб працювало і /me/plan — треба "/me/" (піддерево)
	mux.Handle("/me/", middleware.AuthMiddleware(jwtService)(protected))

	// profile як було
	mux.Handle("/profile", middleware.AuthMiddleware(jwtService)(protected))
}
