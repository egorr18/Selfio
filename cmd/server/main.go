package main

import (
	"log"

	"backend/internal/httpserver"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println(".env not found, using system env")
	}

	httpserver.Run()
}
