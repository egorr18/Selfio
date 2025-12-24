package httpserver

import (
	"log"
	"net/http"
	"time"

	"backend/internal/config"
	"backend/internal/database"
	"backend/internal/handlers"
	"backend/internal/repository"
	"backend/internal/services"
)

func Run() {
	// --- config ---
	cfg := config.Load()

	// --- database ---
	db, err := database.NewPostgres(database.DBConfig{
		Host:     cfg.DB.Host,
		Port:     cfg.DB.Port,
		User:     cfg.DB.User,
		Password: cfg.DB.Password,
		Name:     cfg.DB.Name,
		SSLMode:  cfg.DB.SSLMode,
	})
	if err != nil {
		log.Fatal("DB connection failed:", err)
	}
	defer db.DB.Close()

	// --- repositories ---
	userRepo := repository.NewUserRepository(db.DB)

	// --- services ---
	authService := services.NewAuthService(userRepo)
	jwtService := services.NewJWTService(
		cfg.JWT.Secret,
		time.Duration(cfg.JWT.TTLMinutes)*time.Minute,
	)

	// --- handlers ---
	authHandler := handlers.NewAuthHandler(authService, jwtService)

	// --- router ---
	mux := http.NewServeMux()
	registerRoutes(mux, authHandler, jwtService)

	// --- middleware ---
	handler := loggingMiddleware(mux)

	addr := ":" + cfg.Port
	log.Printf("HTTP server running on %s", addr)

	// --- server ---
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}
