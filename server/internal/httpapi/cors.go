package httpapi

import (
	"net/http"
	"strings"
)

const defaultCORSAllowHeaders = "Authorization, Content-Type"
const defaultCORSAllowMethods = "GET, POST, PUT, PATCH, DELETE, OPTIONS"

func CORSMiddleware(allowedOrigins []string, next http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		allowed[strings.TrimSpace(origin)] = struct{}{}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if origin == "" {
			next.ServeHTTP(w, r)
			return
		}

		appendVary(w.Header(), "Origin")
		appendVary(w.Header(), "Access-Control-Request-Method")
		appendVary(w.Header(), "Access-Control-Request-Headers")

		if _, ok := allowed[origin]; !ok {
			next.ServeHTTP(w, r)
			return
		}

		header := w.Header()
		header.Set("Access-Control-Allow-Origin", origin)
		header.Set("Access-Control-Allow-Methods", defaultCORSAllowMethods)
		header.Set("Access-Control-Allow-Headers", requestedCORSHeaders(r))
		header.Set("Access-Control-Max-Age", "600")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func requestedCORSHeaders(r *http.Request) string {
	requested := strings.TrimSpace(r.Header.Get("Access-Control-Request-Headers"))
	if requested == "" {
		return defaultCORSAllowHeaders
	}

	return requested
}

func appendVary(header http.Header, value string) {
	for _, existing := range header.Values("Vary") {
		for _, item := range strings.Split(existing, ",") {
			if strings.EqualFold(strings.TrimSpace(item), value) {
				return
			}
		}
	}

	header.Add("Vary", value)
}
