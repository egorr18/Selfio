package config

import (
	"fmt"
	"log"
	"os"
)

type Config struct {
	Env  string
	Port string
	DB   DBConfig
	JWT  JWTConfig
}

type DBConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
}

type JWTConfig struct {
	Secret     string
	TTLMinutes int
}

func Load() *Config {
	cfg := &Config{
		Env:  getEnv("APP_ENV", "local"),
		Port: getEnv("APP_PORT", "8080"),
		DB: DBConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "selfio"),
			Password: getEnv("DB_PASSWORD", "selfio_pass"),
			Name:     getEnv("DB_NAME", "selfio_db"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		JWT: JWTConfig{
			Secret:     getEnv("JWT_SECRET", "super-secret-key"),
			TTLMinutes: getEnvInt("JWT_TTL_MINUTES", 60),
		},
	}

	log.Printf(
		"Config loaded: env=%s port=%s db=%s",
		cfg.Env,
		cfg.Port,
		cfg.DB.Name,
	)

	return cfg
}

// -------- helpers --------

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		var i int
		_, err := fmt.Sscanf(v, "%d", &i)
		if err == nil {
			return i
		}
	}
	return fallback
}
