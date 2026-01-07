package handlers

import (
	"encoding/json"
	"net/http"

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
	ID    int64  `json:"id"`
	Email string `json:"email"`
	Plan  string `json:"plan"`
}

func (h *MeHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "no user id", http.StatusUnauthorized)
		return
	}

	user, err := h.repo.GetByID(r.Context(), userID)
	if err != nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, meResponse{
		ID:    user.ID,
		Email: user.Email,
		Plan:  user.Plan,
	})
}

type planRequest struct {
	Plan string `json:"plan"`
}

func (h *MeHandler) UpdatePlan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut && r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "no user id", http.StatusUnauthorized)
		return
	}

	var req planRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	plan := req.Plan
	if plan != "free" && plan != "pro" && plan != "premium" {
		http.Error(w, "invalid plan", http.StatusBadRequest)
		return
	}

	updated, err := h.repo.UpdatePlan(r.Context(), userID, plan)
	if err != nil {
		http.Error(w, "failed to update plan", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"plan": updated})
}
