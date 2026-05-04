'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Plus, Trash2, MessageSquare, Sparkles, Paperclip, Bot } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  streaming?: boolean
}

interface Conversation {
  id: string
  dbId: string
  title: string
  preview: string
  messageCount: number
  updatedAt: string
}

const SUGGESTED_PROMPTS = [
  { text: 'What controls am I missing for SOC 2?', icon: '🔍' },
  { text: 'Show me evidence gaps for ISO 27001', icon: '📋' },
  { text: 'Summarize my current compliance posture', icon: '📊' },
  { text: 'What are my highest priority findings?', icon: '🚨' },
  { text: 'Generate a risk assessment summary', icon: '⚖️' },
]

// Simple regex-based markdown renderer — no external libs
function renderMarkdown(content: string): string {
  let html = content
  // Escape HTML
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
  // Paragraphs / line breaks
  html = html.replace(/\n\n/g, '</p><p>')
  html = html.replace(/\n/g, '<br/>')
  html = `<p>${html}</p>`
  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '')
  html = html.replace(/<p>(<h[1-3]>)/g, '$1')
  html = html.replace(/(<\/h[1-3]>)<\/p>/g, '$1')
  html = html.replace(/<p>(<ul>)/g, '$1')
  html = html.replace(/(<\/ul>)<\/p>/g, '$1')
  html = html.replace(/<p>(<pre>)/g, '$1')
  html = html.replace(/(<\/pre>)<\/p>/g, '$1')
  return html
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatDate(ts: string): string {
  try {
    const d = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 86400000) return 'Today'
    if (diff < 172800000) return 'Yesterday'
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [loadingConvs, setLoadingConvs] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/conversations')
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
      }
    } catch {
      // ignore
    } finally {
      setLoadingConvs(false)
    }
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load a conversation
  const loadConversation = async (convId: string) => {
    try {
      const res = await fetch(`/api/ai/conversations/${convId}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        setActiveConvId(convId)
      }
    } catch {
      // ignore
    }
  }

  const startNewChat = () => {
    setMessages([])
    setActiveConvId(null)
    setInput('')
    if (abortRef.current) abortRef.current.abort()
  }

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch(`/api/ai/conversations/${convId}`, { method: 'DELETE' })
      if (activeConvId === convId) startNewChat()
      setConversations((prev) => prev.filter((c) => c.id !== convId))
    } catch {
      // ignore
    }
  }

  const sendMessage = async (msgText?: string) => {
    const text = (msgText || input).trim()
    if (!text || isStreaming) return

    setInput('')
    const userMsg: Message = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    const aiMsg: Message = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      streaming: true,
    }
    setMessages((prev) => [...prev, aiMsg])
    setIsStreaming(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationId: activeConvId,
        }),
        signal: ctrl.signal,
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buffer = ''
      let newConvId: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += dec.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'token') {
              setMessages((prev) => {
                const next = [...prev]
                const last = next[next.length - 1]
                if (last?.role === 'assistant') {
                  next[next.length - 1] = { ...last, content: last.content + parsed.content }
                }
                return next
              })
            } else if (parsed.type === 'done') {
              newConvId = parsed.conversationId
              setMessages((prev) => {
                const next = [...prev]
                const last = next[next.length - 1]
                if (last?.role === 'assistant') {
                  next[next.length - 1] = { ...last, streaming: false }
                }
                return next
              })
            } else if (parsed.type === 'error') {
              setMessages((prev) => {
                const next = [...prev]
                const last = next[next.length - 1]
                if (last?.role === 'assistant') {
                  next[next.length - 1] = {
                    ...last,
                    content: `Error: ${parsed.content}`,
                    streaming: false,
                  }
                }
                return next
              })
            }
          } catch {
            // Skip malformed
          }
        }
      }

      if (newConvId && !activeConvId) {
        setActiveConvId(newConvId)
        await loadConversations()
      } else if (activeConvId) {
        await loadConversations()
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.role === 'assistant') {
          next[next.length - 1] = {
            ...last,
            content: 'Connection error. Please try again.',
            streaming: false,
          }
        }
        return next
      })
    } finally {
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [input])

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px - 48px)', gap: 0, overflow: 'hidden' }}>
      {/* Left Sidebar — Conversation History */}
      <aside
        style={{
          width: 260,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(255,255,255,0.02)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        {/* New Chat */}
        <div style={{ padding: '12px 12px 8px' }}>
          <button
            onClick={startNewChat}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 14px',
              background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <Plus size={15} />
            New Chat
          </button>
        </div>

        <div
          style={{
            padding: '4px 12px 6px',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.3)',
          }}
        >
          Recent
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
          {loadingConvs ? (
            <div style={{ padding: '12px', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
              Loading...
            </div>
          ) : conversations.length === 0 ? (
            <div
              style={{
                padding: '16px 12px',
                fontSize: 12,
                color: 'rgba(255,255,255,0.3)',
                textAlign: 'center',
              }}
            >
              No conversations yet
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '9px 10px',
                  background:
                    activeConvId === conv.id
                      ? 'rgba(139,92,246,0.15)'
                      : 'transparent',
                  border:
                    activeConvId === conv.id
                      ? '1px solid rgba(139,92,246,0.3)'
                      : '1px solid transparent',
                  borderRadius: 8,
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: 2,
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (activeConvId !== conv.id)
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                }}
                onMouseLeave={(e) => {
                  if (activeConvId !== conv.id)
                    e.currentTarget.style.background = 'transparent'
                }}
              >
                <MessageSquare
                  size={13}
                  style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0, marginTop: 2 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'rgba(255,255,255,0.85)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 150,
                    }}
                  >
                    {conv.title}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                    {formatDate(conv.updatedAt)}
                  </div>
                </div>
                <button
                  onClick={(e) => deleteConversation(conv.id, e)}
                  style={{
                    padding: 3,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'rgba(255,255,255,0.25)',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(239,68,68,0.8)')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')
                  }
                >
                  <Trash2 size={11} />
                </button>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bot size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
              CompliGuard AI
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              Compliance &amp; GRC Expert Assistant
            </div>
          </div>
          {isStreaming && (
            <div
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: '#8B5CF6',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#8B5CF6',
                  animation: 'pulse 1.2s ease-in-out infinite',
                  display: 'inline-block',
                }}
              />
              Thinking...
            </div>
          )}
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {messages.length === 0 ? (
            /* Empty state — suggested prompts */
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 24,
                padding: '40px 20px',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 60,
                    height: 60,
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.3) 0%, rgba(6,182,212,0.3) 100%)',
                    border: '1px solid rgba(139,92,246,0.3)',
                    borderRadius: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}
                >
                  <Sparkles size={28} color="#8B5CF6" />
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.9)',
                    marginBottom: 8,
                  }}
                >
                  How can I help you today?
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', maxWidth: 400 }}>
                  Ask me about your compliance posture, control gaps, evidence requirements, or
                  risk findings.
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 10,
                  width: '100%',
                  maxWidth: 640,
                }}
              >
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p.text}
                    onClick={() => sendMessage(p.text)}
                    disabled={isStreaming}
                    style={{
                      padding: '12px 14px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.75)',
                      transition: 'all 0.15s',
                      lineHeight: 1.4,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(139,92,246,0.12)'
                      e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                    }}
                  >
                    <span style={{ marginRight: 6 }}>{p.icon}</span>
                    {p.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                {msg.role === 'assistant' && (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      background:
                        'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    <Bot size={14} color="#fff" />
                  </div>
                )}

                <div
                  style={{
                    maxWidth: '72%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      padding: msg.role === 'user' ? '10px 14px' : '12px 16px',
                      background:
                        msg.role === 'user'
                          ? 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)'
                          : 'rgba(255,255,255,0.06)',
                      border:
                        msg.role === 'user'
                          ? 'none'
                          : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '4px 12px 12px 12px',
                      fontSize: 13.5,
                      lineHeight: 1.6,
                      color: 'rgba(255,255,255,0.9)',
                      backdropFilter: msg.role === 'assistant' ? 'blur(20px)' : undefined,
                    }}
                  >
                    {msg.role === 'user' ? (
                      <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                    ) : msg.streaming && msg.content === '' ? (
                      <TypingIndicator />
                    ) : (
                      <div
                        className="ai-markdown"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                      />
                    )}
                    {msg.role === 'assistant' && msg.streaming && msg.content !== '' && (
                      <span
                        style={{
                          display: 'inline-block',
                          width: 7,
                          height: 14,
                          background: '#8B5CF6',
                          borderRadius: 2,
                          marginLeft: 2,
                          verticalAlign: 'middle',
                          animation: 'blink 0.8s step-end infinite',
                        }}
                      />
                    )}
                  </div>
                  {msg.timestamp && (
                    <div
                      style={{
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.25)',
                        paddingLeft: msg.role === 'assistant' ? 4 : 0,
                        paddingRight: msg.role === 'user' ? 4 : 0,
                      }}
                    >
                      {formatTime(msg.timestamp)}
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.6)',
                      fontWeight: 600,
                    }}
                  >
                    U
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: '8px 12px',
              transition: 'border-color 0.15s',
            }}
            onFocusCapture={(e) => {
              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
            }}
          >
            {/* Attach placeholder */}
            <button
              style={{
                padding: 6,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.3)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
              title="Attach file (coming soon)"
            >
              <Paperclip size={15} />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about compliance, controls, findings..."
              rows={1}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'rgba(255,255,255,0.9)',
                fontSize: 13.5,
                lineHeight: 1.5,
                resize: 'none',
                minHeight: 22,
                maxHeight: 120,
                fontFamily: 'inherit',
              }}
            />

            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isStreaming}
              style={{
                width: 34,
                height: 34,
                background:
                  input.trim() && !isStreaming
                    ? 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)'
                    : 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: 9,
                cursor: input.trim() && !isStreaming ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              <Send size={14} color={input.trim() && !isStreaming ? '#fff' : 'rgba(255,255,255,0.3)'} />
            </button>
          </div>
          <div
            style={{
              textAlign: 'center',
              fontSize: 10,
              color: 'rgba(255,255,255,0.2)',
              marginTop: 6,
            }}
          >
            Enter to send · Shift+Enter for new line
          </div>
        </div>
      </div>

      <style>{`
        .ai-markdown p { margin: 0 0 8px; }
        .ai-markdown p:last-child { margin-bottom: 0; }
        .ai-markdown h1 { font-size: 17px; font-weight: 700; margin: 12px 0 6px; color: rgba(255,255,255,0.95); }
        .ai-markdown h2 { font-size: 15px; font-weight: 700; margin: 10px 0 5px; color: rgba(255,255,255,0.92); }
        .ai-markdown h3 { font-size: 13.5px; font-weight: 600; margin: 8px 0 4px; color: rgba(255,255,255,0.9); }
        .ai-markdown ul { margin: 4px 0 8px; padding-left: 18px; }
        .ai-markdown li { margin-bottom: 4px; }
        .ai-markdown code { background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.2); padding: 1px 5px; border-radius: 4px; font-family: monospace; font-size: 12.5px; color: #a78bfa; }
        .ai-markdown pre { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px; overflow-x: auto; margin: 8px 0; }
        .ai-markdown pre code { background: none; border: none; padding: 0; color: rgba(255,255,255,0.8); }
        .ai-markdown strong { font-weight: 700; color: rgba(255,255,255,0.95); }
        .ai-markdown em { font-style: italic; color: rgba(255,255,255,0.8); }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes typing-dot { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }
      `}</style>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#8B5CF6',
            display: 'inline-block',
            animation: `typing-dot 1.2s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  )
}
