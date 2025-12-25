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

	_ "backend/docs"
	"backend/internal/httpserver"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println(".env not found, using system env")
	}

	httpserver.Run()
}
