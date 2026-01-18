package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"backend/internal/middleware"
	"backend/internal/repository"

	"golang.org/x/crypto/bcrypt"
)

type MeHandler struct {
	repo repository.UserRepository
}

func NewMeHandler(repo repository.UserRepository) *MeHandler {
	return &MeHandler{repo: repo}
}

type meResponse struct {
	ID        int64  `json:"id"`
	Email     string `json:"email"`
	Plan      string `json:"plan"` // "" якщо не вибрано
	CreatedAt string `json:"created_at"`
}

func (h *MeHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "missing user id", http.StatusUnauthorized)
		return
	}

	u, err := h.repo.GetByID(r.Context(), userID)
	if err != nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, meResponse{
		ID:        u.ID,
		Email:     u.Email,
		Plan:      u.Plan,
		CreatedAt: u.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	})
}

type selectPlanRequest struct {
	Plan string `json:"plan"`
}

func (h *MeHandler) SelectPlan(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "missing user id", http.StatusUnauthorized)
		return
	}

	var req selectPlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	plan := strings.ToLower(strings.TrimSpace(req.Plan))
	if plan != "free" && plan != "pro" && plan != "premium" {
		http.Error(w, "invalid plan", http.StatusBadRequest)
		return
	}

	if err := h.repo.SetPlan(r.Context(), userID, plan); err != nil {
		http.Error(w, "failed to set plan", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "plan": plan})
}

// -------------------- DELETE ACCOUNT --------------------

type deleteMeRequest struct {
	Password string `json:"password"`
}

func (h *MeHandler) DeleteMe(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "missing user id", http.StatusUnauthorized)
		return
	}

	var req deleteMeRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	req.Password = strings.TrimSpace(req.Password)
	if req.Password == "" {
		http.Error(w, "password is required", http.StatusBadRequest)
		return
	}

	// 1) беремо юзера з БД
	u, err := h.repo.GetByID(r.Context(), userID)
	if err != nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	// 2) перевіряємо пароль
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.Password)); err != nil {
		http.Error(w, "invalid password", http.StatusUnauthorized)
		return
	}

	// 3) видаляємо
	if err := h.repo.DeleteByID(r.Context(), userID); err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			http.Error(w, "user not found", http.StatusNotFound)
			return
		}
		http.Error(w, "failed to delete account", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
