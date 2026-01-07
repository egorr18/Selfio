package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"backend/internal/middleware"
	"backend/internal/repository"
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
