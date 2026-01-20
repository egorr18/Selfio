// @title           Selfio API
// @version         1.0
// @description     Backend API for Selfio project
// @termsOfService  http://swagger.io/terms/

// @contact.name   Egor Korol
// @contact.email  your@email.com

// @license.name  MIT

// @host      localhost:8080
// @BasePath  /

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization

package main

import (
	"log"
	"os"

	"backend/docs"
	"backend/internal/httpserver"

	"github.com/joho/godotenv"
)

func main() {
	// .env (локально) — в Docker може не бути потрібно, але не заважає
	if err := godotenv.Load(); err != nil {
		log.Println(".env not found, using system env")
	}

	// якщо задано SWAGGER_HOST — Swagger UI буде підставляти правильний домен
	if h := os.Getenv("SWAGGER_HOST"); h != "" {
		docs.SwaggerInfo.Host = h
	}

	// Sentry init (повертає cleanup func)
	cleanup := httpserver.InitSentry()
	defer cleanup()

	// старт сервера
	httpserver.Run()
}
