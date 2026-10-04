package httpapi

import (
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"example.com/app-template/server/internal/mcp"
	"example.com/app-template/server/internal/storage"
)

// registerMCPRoutes wires the Model Context Protocol server onto the HTTP API.
//
// Transport (Streamable HTTP, spec 2025-03-26+):
//   - POST /api/mcp — JSON-RPC over HTTP. Returns a plain application/json body
//     by default; returns an SSE stream (event: message) when the client sends
//     `Accept: application/json, text/event-stream`.
//   - GET /api/mcp  — SSE endpoint for legacy Streamable HTTP clients that
//     discover the POST endpoint first (Claude Code, older Cursor versions).
//
// The MCP server shares the same *sql.DB connection as the API, so it always
// sees the same training data as the REST endpoints — no separate process.
func registerMCPRoutes(mux *http.ServeMux, db *sql.DB, store storage.Storage) {
	mcpServer := mcp.NewServer(db, store)

	// POST /api/mcp — main JSON-RPC endpoint (Streamable HTTP).
	mux.HandleFunc("POST /api/mcp", func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			WriteError(w, http.StatusBadRequest, fmt.Sprintf("read body: %v", err))
			return
		}

		response := mcpServer.Handle(r.Context(), string(body))
		if response == "" {
			// Notification — no response expected.
			w.WriteHeader(http.StatusAccepted)
			return
		}

		// Streamable HTTP: if the client asked for SSE, frame the response as an
		// `event: message` (and `data: <json>`); otherwise plain JSON works and is
		// what most clients (Claude Desktop, Copilot Chat) accept.
		if wantsSSE(r) {
			w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("Connection", "keep-alive")
			w.WriteHeader(http.StatusOK)
			fmt.Fprintf(w, "event: message\ndata: %s\n\n", strings.ReplaceAll(response, "\n", ""))
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
			return
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(response))
	})

	// GET /api/mcp — SSE endpoint for legacy clients that expect an initial
	// `event: endpoint` message before POSTing JSON-RPC requests.
	mux.HandleFunc("GET /api/mcp", func(w http.ResponseWriter, r *http.Request) {
		// Only clients that explicitly accept text/event-stream should get SSE;
		// anything else gets a short JSON info document telling them to POST.
		if !wantsSSE(r) {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			WriteJSON(w, http.StatusOK, map[string]string{
				"endpoint":   "/api/mcp",
				"transport":  "streamable-http",
				"protocol":   mcp.LatestProtocolVersion,
				"serverInfo": "agon-training-mcp",
			})
			return
		}

		sessionID := fmt.Sprintf("agon-%d", time.Now().UnixNano())
		w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusOK)

		// Announce the POST endpoint (with session so clients can correlate).
		fmt.Fprintf(w, "event: endpoint\ndata: /api/mcp?session=%s\n\n", sessionID)
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}

		// Keep the connection open until the client disconnects.
		<-r.Context().Done()
	})
}

// wantsSSE reports whether the request asks for text/event-stream content.
func wantsSSE(r *http.Request) bool {
	accept := r.Header.Get("Accept")
	return strings.Contains(accept, "text/event-stream")
}