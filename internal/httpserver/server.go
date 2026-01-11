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

	// RUN MIGRATIONS (тут!)
	if err := database.RunMigrations(db.DB, "./migrations"); err != nil {
		log.Fatal("migrations failed:", err)
	}
	log.Println("Migrations applied")

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

	// ---- NEW: strict CORS allowlist ----
	allowedOrigins := []string{
		"https://egorr18.github.io",
		"http://localhost:5500",
		"http://127.0.0.1:5500",
	}

	// ---- NEW: rate limits ----
	rl := RateLimitConfig{
		GlobalRPS:   10,
		GlobalBurst: 20,
		AuthRPS:     2,
		AuthBurst:   5,
	}

	// ---- middleware chain ----
	base := http.Handler(mux)

	// production HTTPS enforce behind proxy (Render)
	base = enforceHTTPSMiddleware(cfg.AppEnv)(base)

	// rate limit (per IP)
	base = rateLimitMiddleware(rl)(base)

	// strict CORS
	base = corsMiddleware(allowedOrigins)(base)

	// logs
	base = loggingMiddleware(base)

	addr := ":" + cfg.Port
	log.Printf("HTTP server running on %s", addr)

	if err := http.ListenAndServe(addr, base); err != nil {
		log.Fatal(err)
	}
}
