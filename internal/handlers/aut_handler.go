package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"backend/internal/services"
)

type AuthHandler struct {
	authService *services.AuthService
	jwtService  *services.JWTService
}

func NewAuthHandler(authService *services.AuthService, jwtService *services.JWTService) *AuthHandler {
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
	Email string `json:"email"`
	Plan  string `json:"plan"`
}

type apiError struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, apiError{Error: "method_not_allowed"})
		return
	}

	req, ok := decodeAuthRequest(w, r)
	if !ok {
		return
	}

	user, err := h.authService.Register(r.Context(), req.Email, req.Password)
	if err != nil {
		if errors.Is(err, services.ErrUserAlreadyExists) {
			writeJSON(w, http.StatusConflict, apiError{Error: "user_exists", Message: "user already exists"})
			return
		}
		log.Printf("[auth/register] error: %v", err)
		writeJSON(w, http.StatusInternalServerError, apiError{Error: "internal_error"})
		return
	}

	token, err := h.jwtService.Generate(user.ID)
	if err != nil {
		log.Printf("[auth/register] token generation error: %v", err)
		writeJSON(w, http.StatusInternalServerError, apiError{Error: "token_error"})
		return
	}

	writeJSON(w, http.StatusCreated, authResponse{
		Token: token,
		Email: user.Email,
		Plan:  user.Plan,
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, apiError{Error: "method_not_allowed"})
		return
	}

	req, ok := decodeAuthRequest(w, r)
	if !ok {
		return
	}

	user, err := h.authService.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		if errors.Is(err, services.ErrInvalidCredentials) {
			writeJSON(w, http.StatusUnauthorized, apiError{Error: "invalid_credentials", Message: "invalid email or password"})
			return
		}
		log.Printf("[auth/login] error: %v", err)
		writeJSON(w, http.StatusInternalServerError, apiError{Error: "internal_error"})
		return
	}

	token, err := h.jwtService.Generate(user.ID)
	if err != nil {
		log.Printf("[auth/login] token generation error: %v", err)
		writeJSON(w, http.StatusInternalServerError, apiError{Error: "token_error"})
		return
	}

	writeJSON(w, http.StatusOK, authResponse{
		Token: token,
		Email: user.Email,
		Plan:  user.Plan,
	})
}

func decodeAuthRequest(w http.ResponseWriter, r *http.Request) (authRequest, bool) {
	var req authRequest

	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	if err := dec.Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "bad_request", Message: "invalid request body"})
		return authRequest{}, false
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Password = strings.TrimSpace(req.Password)

	if req.Email == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "bad_request", Message: "email and password are required"})
		return authRequest{}, false
	}

	// Можеш поставити мін довжину
	if len(req.Password) < 6 {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "bad_request", Message: "password too short"})
		return authRequest{}, false
	}

	return req, true
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
