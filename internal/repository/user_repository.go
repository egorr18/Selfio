package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"backend/internal/models"
)

var ErrUserNotFound = errors.New("user not found")

type UserRepository interface {
	Create(ctx context.Context, email, passwordHash string) (*models.User, error)
	GetByEmail(ctx context.Context, email string) (*models.User, error)

	GetByID(ctx context.Context, id int64) (*models.User, error)
	SetPlan(ctx context.Context, id int64, plan string) error

	UpdatePasswordHash(ctx context.Context, id int64, passwordHash string) error

	DeleteByID(ctx context.Context, id int64) error
}

type PostgresUserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) UserRepository {
	return &PostgresUserRepository{db: db}
}

func (r *PostgresUserRepository) Create(ctx context.Context, email string, passwordHash string) (*models.User, error) {
	query := `
		INSERT INTO users (email, password_hash)
		VALUES ($1, $2)
		RETURNING id, email, COALESCE(plan, 'free'), password_hash, created_at
	`

	var user models.User
	err := r.db.QueryRowContext(ctx, query, email, passwordHash).
		Scan(&user.ID, &user.Email, &user.Plan, &user.PasswordHash, &user.CreatedAt)
	if err != nil {
		return nil, err
	}

	return &user, nil
}

func (r *PostgresUserRepository) DeleteByID(ctx context.Context, id int64) error {
	query := `DELETE FROM users WHERE id = $1`
	res, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}

	n, err := res.RowsAffected()
	if err == nil && n == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (r *PostgresUserRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	query := `
		SELECT id, email, COALESCE(plan, 'free'), password_hash, created_at
		FROM users
		WHERE email = $1
	`

	var user models.User
	err := r.db.QueryRowContext(ctx, query, email).
		Scan(&user.ID, &user.Email, &user.Plan, &user.PasswordHash, &user.CreatedAt)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	return &user, nil
}

func (r *PostgresUserRepository) GetByID(ctx context.Context, id int64) (*models.User, error) {
	query := `
		SELECT id, email, COALESCE(plan, 'free'), password_hash, created_at
		FROM users
		WHERE id = $1
	`

	var user models.User
	err := r.db.QueryRowContext(ctx, query, id).
		Scan(&user.ID, &user.Email, &user.Plan, &user.PasswordHash, &user.CreatedAt)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	return &user, nil
}

func (r *PostgresUserRepository) SetPlan(ctx context.Context, id int64, plan string) error {
	query := `UPDATE users SET plan = $1 WHERE id = $2`
	res, err := r.db.ExecContext(ctx, query, plan, id)
	if err != nil {
		return err
	}

	n, err := res.RowsAffected()
	if err == nil && n == 0 {
		return ErrUserNotFound
	}
	return err
}

func (r *PostgresUserRepository) UpdatePasswordHash(ctx context.Context, id int64, passwordHash string) error {
	query := `UPDATE users SET password_hash = $1 WHERE id = $2`
	res, err := r.db.ExecContext(ctx, query, passwordHash, id)
	if err != nil {
		return err
	}

	n, err := res.RowsAffected()
	if err == nil && n == 0 {
		return ErrUserNotFound
	}
	return err
}

// DTO для адмінки
type AdminUser struct {
	ID           int64     `json:"id"`
	Email        string    `json:"email"`
	CreatedAt    time.Time `json:"created_at"`
	PasswordHash string    `json:"password_hash,omitempty"`
}

func (r *PostgresUserRepository) List(ctx context.Context, includeHash bool) ([]AdminUser, error) {
	// Спробуємо з created_at (якщо колонка є)
	var query string
	if includeHash {
		query = `SELECT id, email, created_at, password_hash FROM users ORDER BY created_at DESC`
	} else {
		query = `SELECT id, email, created_at FROM users ORDER BY created_at DESC`
	}

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		// fallback без created_at (якщо схема стара)
		if includeHash {
			query = `SELECT id, email, password_hash FROM users ORDER BY id DESC`
		} else {
			query = `SELECT id, email FROM users ORDER BY id DESC`
		}

		rows, err = r.db.QueryContext(ctx, query)
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		out := make([]AdminUser, 0)
		for rows.Next() {
			var u AdminUser
			u.CreatedAt = time.Time{}
			if includeHash {
				if err := rows.Scan(&u.ID, &u.Email, &u.PasswordHash); err != nil {
					return nil, err
				}
			} else {
				if err := rows.Scan(&u.ID, &u.Email); err != nil {
					return nil, err
				}
			}
			out = append(out, u)
		}
		return out, rows.Err()
	}
	defer rows.Close()

	out := make([]AdminUser, 0)
	for rows.Next() {
		var u AdminUser
		if includeHash {
			if err := rows.Scan(&u.ID, &u.Email, &u.CreatedAt, &u.PasswordHash); err != nil {
				return nil, err
			}
		} else {
			if err := rows.Scan(&u.ID, &u.Email, &u.CreatedAt); err != nil {
				return nil, err
			}
		}
		out = append(out, u)
	}

	return out, rows.Err()
}
