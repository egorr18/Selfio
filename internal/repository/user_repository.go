package repository

import (
	"context"
	"database/sql"
	"errors"

	"backend/internal/models"
)

var ErrUserNotFound = errors.New("user not found")

// 🔹 INTERFACE (ключ до тестів)
type UserRepository interface {
	Create(ctx context.Context, email, passwordHash string) (*models.User, error)
	GetByEmail(ctx context.Context, email string) (*models.User, error)
}

// 🔹 POSTGRES IMPLEMENTATION
type PostgresUserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) UserRepository {
	return &PostgresUserRepository{db: db}
}

func (r *PostgresUserRepository) Create(
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

func (r *PostgresUserRepository) GetByEmail(
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

func (r *PostgresUserRepository) List(ctx context.Context, limit int) ([]models.User, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	query := `
		SELECT id, email, password_hash, created_at
		FROM users
		ORDER BY created_at DESC
		LIMIT $1
	`

	rows, err := r.db.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]models.User, 0, limit)

	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return users, nil
}
