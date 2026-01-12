package services

import (
	"context"
	"errors"
	"strings"

	"backend/internal/models"
	"backend/internal/repository"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserNotFound       = errors.New("user_not_found")
	ErrInvalidCredentials = errors.New("invalid_credentials")
	ErrUserAlreadyExists  = errors.New("user_already_exists")
)

type AuthService struct {
	repo repository.UserRepository // НЕ *repository.UserRepository
}

func NewAuthService(repo repository.UserRepository) *AuthService { // НЕ *repository.UserRepository
	return &AuthService{repo: repo}
}

func (s *AuthService) Register(ctx context.Context, email, password string) (*models.User, error) {
	email = strings.TrimSpace(strings.ToLower(email))

	// 1) Перевірка чи існує
	_, err := s.repo.GetByEmail(ctx, email)
	if err == nil {
		return nil, ErrUserAlreadyExists
	}
	if err != nil && !errors.Is(err, repository.ErrUserNotFound) {
		// реальна помилка БД (міграції/схема/конект) — НЕ маскуємо
		return nil, err
	}

	// 2) Створюємо
	hash, err := HashPassword(password)
	if err != nil {
		return nil, err
	}

	user, err := s.repo.Create(ctx, email, hash)
	if err != nil {
		// тут може бути race-condition (дуже рідко), але хоча б не маскуємо все під 409
		return nil, err
	}

	return user, nil
}

func (s *AuthService) Login(ctx context.Context, email, password string) (*models.User, error) {
	email = strings.TrimSpace(strings.ToLower(email))

	user, err := s.repo.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	if err := CheckPassword(password, user.PasswordHash); err != nil {
		return nil, ErrInvalidCredentials
	}

	return user, nil
}

// helpers

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func CheckPassword(password, hash string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}
