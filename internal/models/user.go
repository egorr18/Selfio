package models

import "time"

type User struct {
	ID           int64     `json:"id"`
	Email        string    `json:"email"`
	Plan         string    `json:"plan"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}
