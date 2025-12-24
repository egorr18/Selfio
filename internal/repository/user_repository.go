package repository

import (
	"context"
	"database/sql"
	"errors"

	"backend/internal/models"
)

var ErrUserNotFound = errors.New("user not found")

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(
	ctx context.Context,
	email string,
	passwordHash string,
) (*models.User, error) {

	query := `
		INSERT INTO users (email, password_hash)
		VALUES ($1, $2)
		RETURNING id, email, password_hash, created_at
	`

	var user models.User

	err := r.db.QueryRowContext(
		ctx,
		query,
		email,
		passwordHash,
	).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.CreatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &user, nil
}

func (r *UserRepository) GetByEmail(
	ctx context.Context,
	email string,
) (*models.User, error) {

	query := `
		SELECT id, email, password_hash, created_at
		FROM users
		WHERE email = $1
	`

	var user models.User

	err := r.db.QueryRowContext(
		ctx,
		query,
		email,
	).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	return &user, nil
}
