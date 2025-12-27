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
	var db *database.Postgres
	var err error

	for i := 1; i <= 10; i++ {
		log.Printf("Trying to connect to DB (attempt %d/10)...", i)

		db, err = database.NewPostgres(database.DBConfig{
			Host:     cfg.DB.Host,
			Port:     cfg.DB.Port,
			User:     cfg.DB.User,
			Password: cfg.DB.Password,
			Name:     cfg.DB.Name,
			SSLMode:  cfg.DB.SSLMode,
		})

		if err == nil {
			log.Println("PostgreSQL connected")
			break
		}

		log.Println("DB not ready yet, retrying in 2s...")
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		log.Fatal("DB connection failed after retries:", err)
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

	// API routes
	registerRoutes(mux, authHandler, jwtService)

	// FRONTEND (HTML / CSS / JS)
	// index.html, /css, /js, /pages
	fs := http.FileServer(http.Dir("./"))
	mux.Handle("/", fs)

	// --- middleware ---
	handler := loggingMiddleware(corsMiddleware(mux))

	addr := ":" + cfg.Port
	log.Printf("HTTP server running on %s", addr)

	// --- server ---
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}
