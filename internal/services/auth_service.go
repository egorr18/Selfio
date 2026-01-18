package services

import (
	"context"
	"errors"

	"backend/internal/models"
	"backend/internal/repository"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserAlreadyExists  = errors.New("user already exists")
	ErrUserNotFound       = errors.New("user not found")
	ErrInvalidCredentials = errors.New("invalid credentials")
)

type AuthService struct {
	userRepo repository.UserRepository
}

func NewAuthService(userRepo repository.UserRepository) *AuthService {
	return &AuthService{userRepo: userRepo}
}

func (s *AuthService) GetByID(ctx context.Context, id int64) (*models.User, error) {
	return s.userRepo.GetByID(ctx, id) // якщо в тебе поле називається інакше — заміни
}

func (s *AuthService) DeleteAccount(ctx context.Context, id int64, currentPassword string) error {
	u, err := s.userRepo.GetByID(ctx, id)
	if err != nil {
		if err == repository.ErrUserNotFound {
			return ErrUserNotFound // якщо в тебе інша помилка — підстав свою
		}
		return err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(currentPassword)); err != nil {
		return ErrInvalidCredentials
	}

	return s.userRepo.DeleteByID(ctx, id)
}

func (s *AuthService) Register(ctx context.Context, email, password string) (*models.User, error) {
	// if exists -> conflict
	if _, err := s.userRepo.GetByEmail(ctx, email); err == nil {
		return nil, ErrUserAlreadyExists
	} else {
		if !errors.Is(err, repository.ErrUserNotFound) {
			// real error
			return nil, err
		}
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	u, err := s.userRepo.Create(ctx, email, string(hash))
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (s *AuthService) Login(ctx context.Context, email, password string) (*models.User, error) {
	u, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	return u, nil
}

// NEW: change password
func (s *AuthService) ChangePassword(ctx context.Context, userID int64, currentPassword, newPassword string) error {
	u, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return ErrUserNotFound
		}
		return err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(currentPassword)); err != nil {
		return ErrInvalidCredentials
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	if err := s.userRepo.UpdatePasswordHash(ctx, userID, string(hash)); err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return ErrUserNotFound
		}
		return err
	}

	return nil
}
