package services

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type JWTService struct {
	secret string
	ttl    time.Duration
}

func NewJWTService(secret string, ttl time.Duration) *JWTService {
	return &JWTService{
		secret: secret,
		ttl:    ttl,
	}
}

func (s *JWTService) Generate(userID int64) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(s.ttl).Unix(),
		"iat":     time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.secret))
}

func (s *JWTService) Parse(tokenString string) (int64, error) {
	if tokenString == "" {
		return 0, errors.New("empty token")
	}

	claims := jwt.MapClaims{}
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
	)

	token, err := parser.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (any, error) {
		return []byte(s.secret), nil
	})
	if err != nil || token == nil || !token.Valid {
		if err == nil {
			err = errors.New("invalid token")
		}
		return 0, err
	}

	v, ok := claims["user_id"]
	if !ok {
		return 0, errors.New("user_id claim missing")
	}

	switch n := v.(type) {
	case float64:
		return int64(n), nil
	case int64:
		return n, nil
	case int:
		return int64(n), nil
	default:
		return 0, fmt.Errorf("user_id has unexpected type: %T", v)
	}
}
