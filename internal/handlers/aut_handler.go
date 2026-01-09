package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"backend/internal/services"
	"golang.org/x/crypto/bcrypt"
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

type errResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"` // якщо хочеш дублювати
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErrorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	req, ok := decodeAuthRequest(w, r)
	if !ok {
		return
	}

	user, err := h.authService.Register(r.Context(), req.Email, req.Password)
	if err != nil {
		if errors.Is(err, services.ErrUserAlreadyExists) {
			writeErrorJSON(w, http.StatusConflict, "user already exists")
			return
		}
		log.Printf("register error: %v", err)
		writeErrorJSON(w, http.StatusInternalServerError, "internal error")
		return
	}

	token, err := h.jwtService.Generate(user.ID)
	if err != nil {
		log.Printf("jwt generate error (register): %v", err)
		writeErrorJSON(w, http.StatusInternalServerError, "token generation failed")
		return
	}

	writeJSON(w, http.StatusCreated, authResponse{
		Token: token,
		Email: user.Email,
		Plan:  user.Plan,
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErrorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	req, ok := decodeAuthRequest(w, r)
	if !ok {
		return
	}

	user, err := h.authService.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		// Мапимо "типові" auth-помилки в 401, навіть якщо сервіс не загорнув їх у ErrInvalidCredentials
		if isInvalidCreds(err) {
			writeErrorJSON(w, http.StatusUnauthorized, "invalid email or password")
			return
		}
		log.Printf("login error: %v", err)
		writeErrorJSON(w, http.StatusInternalServerError, "internal error")
		return
	}

	token, err := h.jwtService.Generate(user.ID)
	if err != nil {
		log.Printf("jwt generate error (login): %v", err)
		writeErrorJSON(w, http.StatusInternalServerError, "token generation failed")
		return
	}

	writeJSON(w, http.StatusOK, authResponse{
		Token: token,
		Email: user.Email,
		Plan:  user.Plan,
	})
}

// ---- helpers ----

func decodeAuthRequest(w http.ResponseWriter, r *http.Request) (authRequest, bool) {
	// захист від дуже великих body
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1MB

	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	var req authRequest
	if err := dec.Decode(&req); err != nil {
		writeErrorJSON(w, http.StatusBadRequest, "invalid request body")
		return authRequest{}, false
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Password = strings.TrimSpace(req.Password)

	if req.Email == "" || req.Password == "" {
		writeErrorJSON(w, http.StatusBadRequest, "email and password are required")
		return authRequest{}, false
	}

	return req, true
}

func isInvalidCreds(err error) bool {
	if errors.Is(err, services.ErrInvalidCredentials) {
		return true
	}
	// якщо сервіс десь повернув сирі помилки:
	if errors.Is(err, sql.ErrNoRows) {
		return true
	}
	if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
		return true
	}
	return false
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeErrorJSON(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(errResponse{Error: msg})
}
