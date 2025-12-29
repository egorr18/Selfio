package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"backend/internal/repository"
)

type AdminHandler struct {
	repo     *repository.PostgresUserRepository
	adminKey string
}

func NewAdminHandler(repo *repository.PostgresUserRepository, adminKey string) *AdminHandler {
	return &AdminHandler{repo: repo, adminKey: adminKey}
}

func (h *AdminHandler) Users(w http.ResponseWriter, r *http.Request) {
	if !h.isAllowed(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	includeHash := r.URL.Query().Get("include_hash") == "1"

	users, err := h.repo.List(r.Context(), includeHash)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(users)
}

func (h *AdminHandler) isAllowed(r *http.Request) bool {
	key := r.Header.Get("X-Admin-Key")
	if key == "" {
		key = r.URL.Query().Get("key")
	}
	return h.adminKey != "" && key == h.adminKey
}

// щоб /admin/users?limit=50 працювало без зайвого коду (не обов'язково)
func getIntQuery(r *http.Request, name string, def int) int {
	v := r.URL.Query().Get(name)
	if v == "" {
		return def
	}
	i, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return i
}
