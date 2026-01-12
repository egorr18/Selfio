package httpserver

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"backend/internal/config"
	"backend/internal/database"
	"backend/internal/handlers"
	mw "backend/internal/middleware"
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

	// --- Run migrations ---
	if err := database.RunMigrations(db.DB, "./migrations"); err != nil {
		log.Fatal("migrations failed:", err)
	}
	log.Println("Migrations applied")

	// --- Repositories ---
	userRepo := repository.NewUserRepository(db.DB)
	pgUserRepo, ok := userRepo.(*repository.PostgresUserRepository)
	if !ok {
		log.Fatal("user repository type assertion failed")
	}

	// --- Services ---
	authService := services.NewAuthService(userRepo)
	jwtService := services.NewJWTService(
		cfg.JWT.Secret,
		time.Duration(cfg.JWT.TTLMinutes)*time.Minute,
	)

	// --- Handlers ---
	authHandler := handlers.NewAuthHandler(authService, jwtService)
	meHandler := handlers.NewMeHandler(userRepo)
	adminHandler := handlers.NewAdminHandler(pgUserRepo, cfg.AdminKey)

	// --- Router ---
	mux := http.NewServeMux()
	registerRoutes(mux, authHandler, meHandler, jwtService)
	mux.HandleFunc("/admin/users", adminHandler.Users)

	// --- Serve static files (for local testing) ---
	fs := http.FileServer(http.Dir("./"))
	mux.Handle("/", fs)

	// --- Middleware chain ---
	handler := mw.RequestID(
		loggingMiddleware(
			CorsMiddleware(
				HTTPSOnlyMiddleware(
					RateLimitMiddleware(mux),
				),
			),
		),
	)

	addr := ":" + cfg.Port
	srv := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	log.Printf("HTTP server running on %s", addr)

	// стартуємо сервер в окремій горутині
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	// graceful shutdown (Render теж шле SIGTERM)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_ = srv.Shutdown(ctx)
	_ = db.DB.Close()

	log.Println("Server stopped")
}
