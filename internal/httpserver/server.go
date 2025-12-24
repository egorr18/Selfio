package httpserver

import (
	"log"
	"net/http"

	"backend/internal/config"
	"backend/internal/database"
)

func Run() {
	cfg := config.Load()

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

	mux := http.NewServeMux()
	registerRoutes(mux)

	handler := loggingMiddleware(mux)

	addr := ":" + cfg.Port
	log.Printf("HTTP server running on %s", addr)

	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}
