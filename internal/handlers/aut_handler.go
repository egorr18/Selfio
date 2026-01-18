package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"backend/internal/middleware"
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
		switch {
		case errors.Is(err, services.ErrUserNotFound):
			writeJSON(w, http.StatusNotFound, apiError{
				Error:   "user_not_found",
				Message: "user not found",
			})
			return

		case errors.Is(err, services.ErrInvalidCredentials):
			writeJSON(w, http.StatusUnauthorized, apiError{
				Error:   "invalid_credentials",
				Message: "invalid email or password",
			})
			return

		default:
			log.Printf("[auth/login] error: %v", err)
			writeJSON(w, http.StatusInternalServerError, apiError{
				Error:   "internal_error",
				Message: "something went wrong",
			})
			return
		}
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

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, apiError{Error: "method_not_allowed"})
		return
	}

	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, apiError{Error: "unauthorized"})
		return
	}

	var req changePasswordRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	if err := dec.Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "bad_request", Message: "invalid request body"})
		return
	}

	req.CurrentPassword = strings.TrimSpace(req.CurrentPassword)
	req.NewPassword = strings.TrimSpace(req.NewPassword)

	if req.CurrentPassword == "" || req.NewPassword == "" {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "bad_request", Message: "current and new password are required"})
		return
	}
	if len(req.NewPassword) < 6 {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "bad_request", Message: "new password too short"})
		return
	}
	if req.NewPassword == req.CurrentPassword {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "bad_request", Message: "new password must be different"})
		return
	}

	if err := h.authService.ChangePassword(r.Context(), userID, req.CurrentPassword, req.NewPassword); err != nil {
		switch {
		case errors.Is(err, services.ErrInvalidCredentials):
			writeJSON(w, http.StatusUnauthorized, apiError{Error: "invalid_credentials", Message: "current password is incorrect"})
			return
		case errors.Is(err, services.ErrUserNotFound):
			writeJSON(w, http.StatusNotFound, apiError{Error: "user_not_found", Message: "user not found"})
			return
		default:
			log.Printf("[auth/change-password] error: %v", err)
			writeJSON(w, http.StatusInternalServerError, apiError{Error: "internal_error"})
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
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

type deleteMeRequest struct {
	Password string `json:"password"`
}

func (h *AuthHandler) Export(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, apiError{Error: "method_not_allowed"})
		return
	}

	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, apiError{Error: "unauthorized"})
		return
	}

	u, err := h.authService.GetByID(r.Context(), userID)
	if err != nil {
		log.Printf("[account/export] error: %v", err)
		writeJSON(w, http.StatusInternalServerError, apiError{Error: "internal_error"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"exported_at": time.Now().UTC(),
		"user": map[string]any{
			"id":         u.ID,
			"email":      u.Email,
			"plan":       u.Plan,
			"created_at": u.CreatedAt,
		},
	})
}

func (h *AuthHandler) DeleteMe(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, apiError{Error: "method_not_allowed"})
		return
	}

	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, apiError{Error: "unauthorized"})
		return
	}

	var req deleteMeRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil || strings.TrimSpace(req.Password) == "" {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "bad_request", Message: "password is required"})
		return
	}

	err := h.authService.DeleteAccount(r.Context(), userID, strings.TrimSpace(req.Password))
	if err != nil {
		if errors.Is(err, services.ErrInvalidCredentials) {
			writeJSON(w, http.StatusUnauthorized, apiError{Error: "invalid_credentials", Message: "invalid password"})
			return
		}
		log.Printf("[account/delete] error: %v", err)
		writeJSON(w, http.StatusInternalServerError, apiError{Error: "internal_error"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
