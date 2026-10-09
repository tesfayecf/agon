// Package mcp server — JSON-RPC 2.0 dispatcher for the Model Context Protocol.
// Routes incoming requests to the registered resource and tool providers.
package mcp

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/tesfayecf/agon/server/internal/storage"
)

// MCPServer is a JSON-RPC 2.0 dispatcher that routes MCP method calls to the
// registered ResourceProvider and ToolProvider.
type MCPServer struct {
	resources *AgonResourceProvider
	tools     *AgonToolProvider
}

func NewServer(db *sql.DB, store storage.Storage) *MCPServer {
	return &MCPServer{
		resources: NewAgonResourceProvider(db, store),
		tools:     NewAgonToolProvider(db, store),
	}
}

// SupportedProtocolVersions lists the MCP spec revisions this server can speak.
var SupportedProtocolVersions = []string{
	"2024-11-05", // original MCP spec
	"2025-03-26", // HTTP+SSE streamable transport revision
	"2025-06-18", // current spec (most clients)
}

// LatestProtocolVersion is what we advertise when the client does not send one.
const LatestProtocolVersion = "2025-06-18"

func supportsProtocolVersion(v string) bool {
	for _, supported := range SupportedProtocolVersions {
		if supported == v {
			return true
		}
	}
	return false
}

// Handle processes a single JSON-RPC request.
func (s *MCPServer) Handle(ctx context.Context, requestBody string) string {
	var req JSONRPCRequest
	dec := json.NewDecoder(strings.NewReader(requestBody))
	if err := dec.Decode(&req); err != nil {
		resp := ErrorResponse(nil, JSONRPCErrorParseError, fmt.Sprintf("Parse error: %v", err))
		buf := strings.Builder{}
		_ = json.NewEncoder(&buf).Encode(resp)
		return buf.String()
	}

	id := req.ID
	if id == nil {
		return "" // notification
	}

	switch req.Method {
	case MCPMethodInitialize:
		return s.handleInitialize(id, req.Params)
	case MCPMethodPing:
		return s.handlePing(id)
	case MCPMethodResourcesList:
		return s.handleResourcesList(ctx, id)
	case MCPMethodResourcesRead:
		return s.handleResourcesRead(ctx, id, req.Params)
	case MCPMethodToolsList:
		return s.handleToolsList(ctx, id)
	case MCPMethodToolsCall:
		return s.handleToolsCall(ctx, id, req.Params)
	default:
		resp := ErrorResponse(id, JSONRPCErrorMethodNotFound, fmt.Sprintf("Method not found: %s", req.Method))
		buf := strings.Builder{}
		_ = json.NewEncoder(&buf).Encode(resp)
		return buf.String()
	}
}

func (s *MCPServer) handleInitialize(id any, params any) string {
	// Negotiate the protocol version: echo the client's requested version when
	// we support it, otherwise fall back to our latest supported version.
	requested := ""
	if m, ok := params.(map[string]any); ok {
		if v, ok := m["protocolVersion"].(string); ok {
			requested = v
		}
	}
	version := LatestProtocolVersion
	if requested != "" && supportsProtocolVersion(requested) {
		version = requested
	}

	result := MCPInitializeResult{
		ProtocolVersion: version,
		Capabilities: MCPCapabilities{
			Resources: &MCPResourcesCapability{Subscribe: false},
			Tools:     &MCPToolsCapability{},
		},
		ServerInfo: MCPServerInfo{
			Name:    "agon-training-mcp",
			Version: "0.1.0",
		},
	}
	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(SuccessResponse(id, result))
	return buf.String()
}

func (s *MCPServer) handlePing(id any) string {
	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(SuccessResponse(id, map[string]any{}))
	return buf.String()
}

func (s *MCPServer) handleResourcesList(ctx context.Context, id any) string {
	resources := s.resources.List(ctx)
	result := MCPListResourcesResult{Resources: resources}
	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(SuccessResponse(id, result))
	return buf.String()
}

func (s *MCPServer) handleResourcesRead(ctx context.Context, id any, params any) string {
	uri := ""
	if m, ok := params.(map[string]any); ok {
		if u, ok := m["uri"].(string); ok {
			uri = u
		}
	}
	if uri == "" {
		buf := strings.Builder{}
		_ = json.NewEncoder(&buf).Encode(ErrorResponse(id, JSONRPCErrorInvalidParams, "uri is required"))
		return buf.String()
	}

	text, err := s.resources.Read(ctx, uri)
	if err != nil {
		buf := strings.Builder{}
		_ = json.NewEncoder(&buf).Encode(ErrorResponse(id, MCPErrorResourceNotFound, err.Error()))
		return buf.String()
	}

	result := MCPReadResourceResult{
		Contents: []MCPResourceContents{
			{URI: uri, MIMEType: "application/json", Text: text},
		},
	}
	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(SuccessResponse(id, result))
	return buf.String()
}

func (s *MCPServer) handleToolsList(ctx context.Context, id any) string {
	tools := s.tools.List(ctx)
	result := MCPListToolsResult{Tools: tools}
	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(SuccessResponse(id, result))
	return buf.String()
}

func (s *MCPServer) handleToolsCall(ctx context.Context, id any, params any) string {
	name := ""
	if m, ok := params.(map[string]any); ok {
		if n, ok := m["name"].(string); ok {
			name = n
		}
	}
	if name == "" {
		buf := strings.Builder{}
		_ = json.NewEncoder(&buf).Encode(ErrorResponse(id, JSONRPCErrorInvalidParams, "name is required"))
		return buf.String()
	}

	// Re-encode arguments as JSON for type-safe decoding in tools
	argsJSON := "{}"
	if m, ok := params.(map[string]any); ok {
		if a, ok := m["arguments"]; ok {
			buf := strings.Builder{}
			_ = json.NewEncoder(&buf).Encode(a)
			argsJSON = buf.String()
		}
	}

	content, err := s.tools.Call(ctx, name, argsJSON)
	if err != nil {
		result := MCPCallToolResult{Content: content, IsError: true}
		buf := strings.Builder{}
		_ = json.NewEncoder(&buf).Encode(SuccessResponse(id, result))
		return buf.String()
	}

	result := MCPCallToolResult{Content: content, IsError: false}
	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(SuccessResponse(id, result))
	return buf.String()
}