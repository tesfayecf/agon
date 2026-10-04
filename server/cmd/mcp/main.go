// MCP stdio server — runs as a subprocess communicating via stdin/stdout.
//
// This binary is designed to be invoked by AI clients (Claude Desktop, Cursor,
// VS Code extensions, etc.) as an MCP tool server. It reads JSON-RPC 2.0
// messages from stdin and writes responses to stdout.
//
// For Claude Desktop integration, create a config entry:
//   {
//     "mcpServers": {
//       "agon-training": {
//         "command": "/path/to/agon/server/cmd/mcp",
//         "args": [],
//         "env": {
//           "SQLITE_PATH": "/path/to/app.db",
//           "HTTP_ADDR": ""
//         }
//       }
//     }
//   }
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"
	"os"
	"strings"

	"example.com/app-template/server/internal/activities"
	"example.com/app-template/server/internal/config"
	"example.com/app-template/server/internal/mcp"
	"example.com/app-template/server/internal/planning"
	"example.com/app-template/server/internal/sqlite"
	"example.com/app-template/server/internal/storage"
	"example.com/app-template/server/internal/trainingplan"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{}))

	cfg, err := config.Load()
	if err != nil {
		logger.Error("load config", "error", err)
		os.Exit(1)
	}

	// Open database
	var db *sql.DB
	if cfg.Database.Enabled {
		db, err = sqlite.Open(context.Background(), sqlite.Config{Path: cfg.Database.Path})
		if err == nil && db != nil {
			_ = activities.EnsureTable(context.Background(), db)
			_ = planning.EnsureTables(context.Background(), db)
			_ = trainingplan.EnsureTables(context.Background(), db)
		}
	}

	store, _ := storage.NewStorage(cfg.S3)
	mcpServer := mcp.NewServer(db, store)

	logger.Info("agon mcp server started (stdio)", "db", cfg.Database.Path)

	// Read JSON-RPC messages line by line from stdin.
	// Each line is one complete JSON-RPC request.
	reader := json.NewDecoder(os.Stdin)

	for reader.More() {
		var rawReq json.RawMessage
		if err := reader.Decode(&rawReq); err != nil {
			break
		}
		rawStr := string(rawReq)
		if strings.TrimSpace(rawStr) == "" {
			continue
		}

		response := mcpServer.Handle(context.Background(), rawStr)
		if response != "" {
			os.Stdout.WriteString(response + "\n")
		}
	}

	logger.Info("agon mcp server stopped")
}