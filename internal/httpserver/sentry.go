package httpserver

import (
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/getsentry/sentry-go"
	sentryhttp "github.com/getsentry/sentry-go/http"
)

func InitSentry() func() {
	dsn := os.Getenv("SENTRY_DSN")
	if dsn == "" {
		// Sentry вимкнений — нічого не робимо
		return func() {}
	}

	tracesRate := 0.0
	if v := os.Getenv("SENTRY_TRACES_SAMPLE_RATE"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			tracesRate = f
		}
	}

	err := sentry.Init(sentry.ClientOptions{
		Dsn:              dsn,
		Environment:      os.Getenv("SENTRY_ENV"),
		Release:          os.Getenv("SENTRY_RELEASE"),
		AttachStacktrace: true,
		TracesSampleRate: tracesRate,
	})
	if err != nil {
		log.Printf("[sentry] init error: %v", err)
		return func() {}
	}

	log.Printf("[sentry] enabled env=%s release=%s", os.Getenv("SENTRY_ENV"), os.Getenv("SENTRY_RELEASE"))

	return func() {
		sentry.Flush(2 * time.Second)
	}
}

func WrapWithSentry(h http.Handler) http.Handler {
	if os.Getenv("SENTRY_DSN") == "" {
		return h
	}

	sh := sentryhttp.New(sentryhttp.Options{
		Repanic: true,
	})

	return sh.Handle(h)
}
