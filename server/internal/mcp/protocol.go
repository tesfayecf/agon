// Package mcp implements the Model Context Protocol (MCP) for this application.
// MCP allows AI models (Claude, GPT, etc.) to discover and interact with
// application resources (training sessions, analytics) and tools (generating
// training plans, creating goals) via a JSON-RPC 2.0 interface.
//
// Protocol reference: https://spec.modelcontextprotocol.io/
package mcp

// --- JSON-RPC 2.0 primitives ---

type JSONRPCRequest struct {
	JSONRPC string   `json:"jsonrpc"` // "2.0"
	ID      any      `json:"id"`      // JSONRPCID or null for notifications
	Method  string   `json:"method"`
	Params  any      `json:"params,omitempty"`
}

type JSONRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

type JSONRPCResponse struct {
	JSONRPC string       `json:"jsonrpc"`
	ID      any          `json:"id"` // JSONRPCID | null
	Result   any          `json:"result,omitempty"`
	Error   *JSONRPCError `json:"error,omitempty"`
}

// --- MCP protocol method constants ---

const (
	// Lifecycle
	MCPMethodInitialize        = "initialize"
	MCPMethodPing              = "ping"

	// Resources
	MCPMethodResourcesList     = "resources/list"
	MCPMethodResourcesRead     = "resources/read"
	MCPMethodResourcesSubscribe  = "resources/subscribe"
	MCPMethodResourcesUnsubscribe = "resources/unsubscribe"

	// Tools
	MCPMethodToolsList         = "tools/list"
	MCPMethodToolsCall         = "tools/call"

	// Prompts
	MCPMethodPromptsList       = "prompts/list"
	MCPMethodPromptsGet        = "prompts/get"
)

// --- MCP type definitions ---

type MCPResource struct {
	URI         string `json:"uri"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	MIMEType    string `json:"mimeType,omitempty"`
}

type MCPResourceContents struct {
	URI    string `json:"uri"`
	MIMEType string `json:"mimeType,omitempty"`
	Text   string `json:"text,omitempty"`
	Blob   string `json:"blob,omitempty"`
}

type MCPTool struct {
	Name        string      `json:"name"`
	Description string      `json:"description,omitempty"`
	InputSchema any         `json:"inputSchema"`
}

type MCPToolCall struct {
	Name      string `json:"name"`
	Arguments any    `json:"arguments,omitempty"`
}

type MCPPrompt struct {
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	Arguments   []MCPPromptArg `json:"arguments,omitempty"`
}

type MCPPromptArg struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Required    bool   `json:"required,omitempty"`
}

// --- Result types for MCP methods ---

type MCPInitializeResult struct {
	ProtocolVersion string              `json:"protocolVersion"`
	Capabilities    MCPCapabilities     `json:"capabilities"`
	ServerInfo      MCPServerInfo       `json:"serverInfo"`
}

type MCPCapabilities struct {
	Resources *MCPResourcesCapability `json:"resources,omitempty"`
	Tools     *MCPToolsCapability     `json:"tools,omitempty"`
	Prompts   *MCPPromptsCapability   `json:"prompts,omitempty"`
}

type MCPResourcesCapability struct {
	Subscribe bool `json:"subscribe,omitempty"`
}

type MCPToolsCapability struct {
	// no additional fields currently
}

type MCPPromptsCapability struct {
	// no additional fields currently
}

type MCPServerInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type MCPListResourcesResult struct {
	Resources []MCPResource    `json:"resources"`
	NextCursor string          `json:"nextCursor,omitempty"`
}

type MCPReadResourceResult struct {
	Contents []MCPResourceContents `json:"contents"`
}

type MCPListToolsResult struct {
	Tools []MCPTool `json:"tools"`
}

type MCPCallToolResult struct {
	Content []MCPToolContentPart `json:"content"`
	IsError bool                 `json:"isError,omitempty"`
}

type MCPToolContentPart struct {
	Type string `json:"type"` // "text" | "resource"
	Text string `json:"text,omitempty"`
	Resource *MCPResourceContents `json:"resource,omitempty"`
}

type MCPListPromptsResult struct {
	Prompts []MCPPrompt `json:"prompts"`
}

type MCPGetPromptResult struct {
	Messages []MCPPromptMessage `json:"messages"`
	Description string `json:"description,omitempty"`
}

type MCPPromptMessage struct {
	Role    string `json:"role"` // "user" | "assistant"
	Content any    `json:"content"`
}

// --- Error codes (JSON-RPC + MCP-specific) ---

const (
	// Standard JSON-RPC error codes
	JSONRPCErrorParseError     = -32700
	JSONRPCErrorInvalidRequest = -32600
	JSONRPCErrorMethodNotFound = -32601
	JSONRPCErrorInvalidParams  = -32602
	JSONRPCErrorInternal       = -32603

	// MCP-specific error codes
	MCPErrorResourceNotFound   = -32002
	MCPErrorToolNotFound       = -32004
	MCPErrorToolExecutionError = -32005
)

func NewError(code int, message string) JSONRPCError {
	return JSONRPCError{Code: code, Message: message}
}

func ErrorResponse(id any, code int, message string) JSONRPCResponse {
	return JSONRPCResponse{
		JSONRPC: "2.0",
		ID:     id,
		Error:  &JSONRPCError{Code: code, Message: message}}
}

func SuccessResponse(id any, result any) JSONRPCResponse {
	return JSONRPCResponse{
		JSONRPC: "2.0",
		ID:     id,
		Result: result,
	}
}

func NewTextContent(text string) MCPToolContentPart {
	return MCPToolContentPart{
		Type: "text",
		Text: text,
	}
}

func NewResourceContent(uri, text, mimeType string) MCPToolContentPart {
	return MCPToolContentPart{
		Type: "resource",
		Resource: &MCPResourceContents{
			URI:      uri,
			Text:     text,
			MIMEType: mimeType,
		},
	}
}