package services

import (
	"context"
	"testing"

	"backend/internal/models"
	"backend/internal/repository"

	"golang.org/x/crypto/bcrypt"
)

//
// MOCK REPOSITORY
//

type mockUserRepository struct {
	createFn             func(ctx context.Context, email, passwordHash string) (*models.User, error)
	getByEmailFn         func(ctx context.Context, email string) (*models.User, error)
	getByIDFn            func(ctx context.Context, id int64) (*models.User, error)
	setPlanFn            func(ctx context.Context, id int64, plan string) error
	deleteByIDFn         func(ctx context.Context, id int64) error
	updatePasswordHashFn func(ctx context.Context, id int64, passwordHash string) error
}

var _ repository.UserRepository = (*mockUserRepository)(nil)

func (m *mockUserRepository) Create(ctx context.Context, email, passwordHash string) (*models.User, error) {
	if m.createFn == nil {
		return &models.User{ID: 1, Email: email, PasswordHash: passwordHash}, nil
	}
	return m.createFn(ctx, email, passwordHash)
}

func (m *mockUserRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	if m.getByEmailFn == nil {
		return nil, repository.ErrUserNotFound
	}
	return m.getByEmailFn(ctx, email)
}

func (m *mockUserRepository) GetByID(ctx context.Context, id int64) (*models.User, error) {
	if m.getByIDFn == nil {
		return nil, repository.ErrUserNotFound
	}
	return m.getByIDFn(ctx, id)
}

func (m *mockUserRepository) SetPlan(ctx context.Context, id int64, plan string) error {
	if m.setPlanFn == nil {
		return nil
	}
	return m.setPlanFn(ctx, id, plan)
}

func (m *mockUserRepository) DeleteByID(ctx context.Context, id int64) error {
	if m.deleteByIDFn == nil {
		return nil
	}
	return m.deleteByIDFn(ctx, id)
}

func (m *mockUserRepository) UpdatePasswordHash(ctx context.Context, id int64, passwordHash string) error {
	if m.updatePasswordHashFn == nil {
		return nil
	}
	return m.updatePasswordHashFn(ctx, id, passwordHash)
}

//
// TESTS
//

func TestAuthService_Register_Success(t *testing.T) {
	repo := &mockUserRepository{
		// Register() спочатку перевіряє GetByEmail:
		getByEmailFn: func(ctx context.Context, email string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
		createFn: func(ctx context.Context, email, passwordHash string) (*models.User, error) {
			return &models.User{ID: 1, Email: email, PasswordHash: passwordHash}, nil
		},
	}

	service := NewAuthService(repo)

	user, err := service.Register(context.Background(), "test@example.com", "password123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if user.Email != "test@example.com" {
		t.Errorf("expected email test@example.com, got %s", user.Email)
	}
}

func TestAuthService_Register_UserAlreadyExists(t *testing.T) {
	repo := &mockUserRepository{
		getByEmailFn: func(ctx context.Context, email string) (*models.User, error) {
			return &models.User{ID: 1, Email: email}, nil
		},
	}

	service := NewAuthService(repo)

	_, err := service.Register(context.Background(), "test@example.com", "password123")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if err != ErrUserAlreadyExists {
		t.Fatalf("expected ErrUserAlreadyExists, got %v", err)
	}
}

func TestAuthService_Login_InvalidPassword(t *testing.T) {
	hashedBytes, _ := bcrypt.GenerateFromPassword([]byte("correct-password"), bcrypt.DefaultCost)
	hashed := string(hashedBytes)

	repo := &mockUserRepository{
		getByEmailFn: func(ctx context.Context, email string) (*models.User, error) {
			return &models.User{
				ID:           1,
				Email:        email,
				PasswordHash: hashed,
			}, nil
		},
	}

	service := NewAuthService(repo)

	_, err := service.Login(context.Background(), "test@example.com", "wrong-password")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if err != ErrInvalidCredentials {
		t.Fatalf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestAuthService_Login_UserNotFound(t *testing.T) {
	repo := &mockUserRepository{
		getByEmailFn: func(ctx context.Context, email string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
	}

	service := NewAuthService(repo)

	_, err := service.Login(context.Background(), "missing@example.com", "password")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	// У твоїй реалізації Login, скоріше за все, повертає ErrInvalidCredentials для "not found"
	if err != ErrInvalidCredentials {
		t.Fatalf("expected ErrInvalidCredentials, got %v", err)
	}
}
