export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
      enum?: string[]
      items?: { type: string }
    }>
    required?: string[]
  }
}

export interface MCPToolCall {
  name: string
  arguments: Record<string, unknown>
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'resource'
    text?: string
    resource?: { uri: string; mimeType: string; text: string }
  }>
  isError?: boolean
}

export interface MCPRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

export interface MCPResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

export interface MCPCapabilities {
  tools: { listChanged?: boolean }
  resources?: { subscribe?: boolean; listChanged?: boolean }
  prompts?: { listChanged?: boolean }
}

export interface MCPServerInfo {
  name: string
  version: string
  protocolVersion: string
}
