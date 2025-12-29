package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"backend/internal/repository"
)

type AdminHandler struct {
	repo     *repository.PostgresUserRepository
	adminKey string
}

func NewAdminHandler(repo *repository.PostgresUserRepository, adminKey string) *AdminHandler {
	return &AdminHandler{repo: repo, adminKey: adminKey}
}

type adminUser struct {
	ID           int64     `json:"id"`
	Email        string    `json:"email"`
	CreatedAt    time.Time `json:"created_at"`
	PasswordHash string    `json:"password_hash,omitempty"`
}

// GET /admin/users
// Auth: header "X-Admin-Key: <ADMIN_KEY>" OR query "?key=<ADMIN_KEY>"
func (h *AdminHandler) Users(w http.ResponseWriter, r *http.Request) {
	key := r.Header.Get("X-Admin-Key")
	if key == "" {
		key = r.URL.Query().Get("key")
	}

	if h.adminKey != "" && key != h.adminKey {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	limit := 100
	if v := r.URL.Query().Get("limit"); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			limit = i
		}
	}

	includeHash := r.URL.Query().Get("include_hash") == "1"

	users, err := h.repo.List(r.Context(), limit)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	out := make([]adminUser, 0, len(users))
	for _, u := range users {
		row := adminUser{
			ID:        u.ID,
			Email:     u.Email,
			CreatedAt: u.CreatedAt,
		}
		if includeHash {
			row.PasswordHash = u.PasswordHash
		}
		out = append(out, row)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}
