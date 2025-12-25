// Profile godoc
// @Summary Get user profile
// @Description Get profile of authenticated user
// @Tags profile
// @Security BearerAuth
// @Produce plain
// @Success 200 {string} string "Hello user with id"
// @Failure 401 {string} string "Unauthorized"
// @Router /profile [get]

package handlers

import (
	"fmt"
	"net/http"

	"backend/internal/middleware"
)

func Profile(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	w.Write([]byte(
		"Hello user with id: " + fmt.Sprint(userID),
	))
}
