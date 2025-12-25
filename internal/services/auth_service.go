package services

import (
	"context"
	"errors"

	"backend/internal/models"
	"backend/internal/repository"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserAlreadyExists  = errors.New("user already exists")
)

type AuthService struct {
	repo repository.UserRepository
}

func NewAuthService(repo repository.UserRepository) *AuthService {
	return &AuthService{repo: repo}
}

func (s *AuthService) Register(
	ctx context.Context,
	email string,
	password string,
) (*models.User, error) {

	hash, err := HashPassword(password)
	if err != nil {
		return nil, err
	}

	user, err := s.repo.Create(ctx, email, hash)
	if err != nil {
		// 👉 у PostgreSQL це буде unique violation
		return nil, ErrUserAlreadyExists
	}

	return user, nil
}

func (s *AuthService) Login(
	ctx context.Context,
	email string,
	password string,
) (*models.User, error) {

	user, err := s.repo.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	if err := CheckPassword(password, user.PasswordHash); err != nil {
		return nil, ErrInvalidCredentials
	}

	return user, nil
}

// ---- helpers ----

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func CheckPassword(password, hash string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}
