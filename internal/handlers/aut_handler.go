package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"backend/internal/services"
)

type AuthHandler struct {
	authService *services.AuthService
	jwtService  *services.JWTService
}

func NewAuthHandler(
	authService *services.AuthService,
	jwtService *services.JWTService,
) *AuthHandler {
	return &AuthHandler{
		authService: authService,
		jwtService:  jwtService,
	}
}

type authRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	Token string `json:"token"`
}

// Register godoc
// @Summary Register new user
// @Description Create new user account
// @Tags auth
// @Accept json
// @Produce json
// @Param request body RegisterRequest true "Register payload"
// @Success 201 {object} TokenResponse
// @Failure 400 {object} ErrorResponse
// @Router /auth/register [post]

// POST /auth/register
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req authRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	user, err := h.authService.Register(r.Context(), req.Email, req.Password)
	if err != nil {
		if errors.Is(err, services.ErrUserAlreadyExists) {
			http.Error(w, "user already exists", http.StatusConflict)
			return
		}

		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	token, err := h.jwtService.Generate(user.ID)
	if err != nil {
		http.Error(w, "token generation failed", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, authResponse{Token: token})
}

// Login godoc
// @Summary Login user
// @Description Authenticate user and return JWT
// @Tags auth
// @Accept json
// @Produce json
// @Param request body LoginRequest true "Login payload"
// @Success 200 {object} TokenResponse
// @Failure 401 {object} ErrorResponse
// @Router /auth/login [post]

// POST /auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req authRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	user, err := h.authService.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		if errors.Is(err, services.ErrInvalidCredentials) {
			http.Error(w, "invalid email or password", http.StatusUnauthorized)
			return
		}

		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	token, err := h.jwtService.Generate(user.ID)
	if err != nil {
		http.Error(w, "token generation failed", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, authResponse{Token: token})
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
