package httpserver

import (
	"log"
	"net/http"

	"backend/internal/config"
	"backend/internal/database"
	"backend/internal/handlers"
	"backend/internal/repository"
	"backend/internal/services"
)

func Run() {
	// 1. Load config
	cfg := config.Load()

	// 2. Connect DB
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

	// 3. Repositories
	userRepo := repository.NewUserRepository(db.DB)

	// 4. Services
	authService := services.NewAuthService(userRepo)

	// 5. Handlers
	authHandler := handlers.NewAuthHandler(authService)

	// 6. Router
	mux := http.NewServeMux()
	registerRoutes(mux, authHandler)

	// 7. Middlewares
	handler := loggingMiddleware(mux)

	// 8. Server
	addr := ":" + cfg.Port
	log.Printf("HTTP server running on %s", addr)

	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}
