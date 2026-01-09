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
	cfg := config.Load()

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

	// repositories
	userRepo := repository.NewUserRepository(db.DB)
	pgUserRepo, ok := userRepo.(*repository.PostgresUserRepository)
	if !ok {
		log.Fatal("user repository type assertion failed")
	}

	// services
	authService := services.NewAuthService(userRepo)
	jwtService := services.NewJWTService(
		cfg.JWT.Secret,
		time.Duration(cfg.JWT.TTLMinutes)*time.Minute,
	)

	// handlers
	authHandler := handlers.NewAuthHandler(authService, jwtService)
	meHandler := handlers.NewMeHandler(userRepo)
	adminHandler := handlers.NewAdminHandler(pgUserRepo, cfg.AdminKey)

	// router
	mux := http.NewServeMux()

	registerRoutes(mux, authHandler, meHandler, jwtService)
	mux.HandleFunc("/admin/users", adminHandler.Users)

	fs := http.FileServer(http.Dir("./"))
	mux.Handle("/", fs)

	// без глобального rate limit
	handler := loggingMiddleware(corsMiddleware(mux))

	addr := ":" + cfg.Port
	log.Printf("HTTP server running on %s", addr)

	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}
