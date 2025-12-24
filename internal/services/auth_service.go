package services

import (
	"context"
	"errors"

	"golang.org/x/crypto/bcrypt"

	"backend/internal/models"
	"backend/internal/repository"
)

var (
	ErrEmailAlreadyExists = errors.New("email already exists")
	ErrInvalidCredentials = errors.New("invalid email or password")
)

type AuthService struct {
	users *repository.UserRepository
}

func NewAuthService(users *repository.UserRepository) *AuthService {
	return &AuthService{users: users}
}

// Register — реєстрація користувача
func (s *AuthService) Register(
	ctx context.Context,
	email string,
	password string,
) (*models.User, error) {

	// 1. Хешуємо пароль
	hash, err := bcrypt.GenerateFromPassword(
		[]byte(password),
		bcrypt.DefaultCost,
	)
	if err != nil {
		return nil, err
	}

	// 2. Створюємо користувача
	user, err := s.users.Create(
		ctx,
		email,
		string(hash),
	)
	if err != nil {
		// тут пізніше можна красиво розпізнавати duplicate email
		return nil, ErrEmailAlreadyExists
	}

	return user, nil
}

// Login — логін користувача
func (s *AuthService) Login(
	ctx context.Context,
	email string,
	password string,
) (*models.User, error) {

	// 1. Знаходимо користувача
	user, err := s.users.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	// 2. Порівнюємо пароль
	err = bcrypt.CompareHashAndPassword(
		[]byte(user.PasswordHash),
		[]byte(password),
	)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	return user, nil
}
