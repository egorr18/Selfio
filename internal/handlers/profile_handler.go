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
