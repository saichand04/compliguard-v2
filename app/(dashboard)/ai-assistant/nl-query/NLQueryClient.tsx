'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Sparkles, Send, ChevronDown, ChevronUp, Loader2,
  AlertCircle, Settings, Wrench,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToolCall {
  tool: string
  args: Record<string, unknown>
  result: string
}

interface NLQueryResponse {
  answer: string
  toolsUsed: ToolCall[]
  confidence: 'high' | 'medium' | 'low'
  followUpQuestions?: string[]
}

type MessageRole = 'user' | 'assistant' | 'error'

interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  toolsUsed?: ToolCall[]
  confidence?: 'high' | 'medium' | 'low'
  followUpQuestions?: string[]
}

// ---------------------------------------------------------------------------
// Suggested questions
// ---------------------------------------------------------------------------

const SUGGESTED_QUESTIONS = [
  "What's our compliance score?",
  'Show critical findings',
  'What are our biggest risks?',
  'Which tasks are overdue?',
]

// ---------------------------------------------------------------------------
// Confidence badge
// ---------------------------------------------------------------------------

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    high:   { bg: 'rgba(74,222,128,0.1)',  text: '#4ADE80', border: 'rgba(74,222,128,0.2)' },
    medium: { bg: 'rgba(251,191,36,0.1)',  text: '#FBBF24', border: 'rgba(251,191,36,0.2)' },
    low:    { bg: 'rgba(239,68,68,0.1)',   text: '#EF4444', border: 'rgba(239,68,68,0.2)' },
  }
  const c = colors[confidence]
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 100,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      letterSpacing: '0.04em', textTransform: 'capitalize',
    }}>
      {confidence} confidence
    </span>
  )
}

// ---------------------------------------------------------------------------
// Tool calls collapsible
// ---------------------------------------------------------------------------

function ToolCallsSection({ tools }: { tools: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false)

  if (tools.length === 0) return null

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setExpanded(x => !x)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          cursor: 'pointer', fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600,
        }}
      >
        <Wrench size={11} />
        {tools.length} tool{tools.length > 1 ? 's' : ''} used
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {expanded && (
        <div style={{
          marginTop: 6, borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)',
          overflow: 'hidden', fontSize: 12,
        }}>
          {tools.map((tc, i) => (
            <div key={i} style={{
              padding: '10px 14px',
              borderBottom: i < tools.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: '#8B5CF6',
                  background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                  padding: '2px 7px', borderRadius: 4,
                }}>
                  {tc.tool}
                </span>
              </div>
              {Object.keys(tc.args).length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Args: </span>
                  <code style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {JSON.stringify(tc.args)}
                  </code>
                </div>
              )}
              <details style={{ marginTop: 4 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, listStyle: 'none' }}>
                  ▶ View result
                </summary>
                <pre style={{
                  marginTop: 6, padding: 10, borderRadius: 6, fontSize: 10,
                  background: 'rgba(0,0,0,0.3)', color: 'var(--text-secondary)',
                  overflow: 'auto', maxHeight: 200, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {tc.result}
                </pre>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

function MessageBubble({ msg, onFollowUp }: { msg: ChatMessage; onFollowUp: (q: string) => void }) {
  const isUser = msg.role === 'user'
  const isError = msg.role === 'error'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 16,
    }}>
      <div style={{
        maxWidth: '78%',
        padding: '12px 16px',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isUser
          ? 'linear-gradient(135deg, #7C3AED, #6D28D9)'
          : isError
            ? 'rgba(239,68,68,0.08)'
            : 'rgba(255,255,255,0.05)',
        border: isUser
          ? 'none'
          : isError
            ? '1px solid rgba(239,68,68,0.2)'
            : '1px solid rgba(255,255,255,0.07)',
        color: isUser ? 'white' : isError ? '#EF4444' : 'var(--text-primary)',
        fontSize: 14,
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {isError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <AlertCircle size={13} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Error</span>
          </div>
        )}
        {msg.content}
      </div>

      {/* Tool calls & confidence (assistant only) */}
      {!isUser && !isError && msg.toolsUsed && (
        <div style={{ maxWidth: '78%', marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {msg.confidence && <ConfidenceBadge confidence={msg.confidence} />}
          </div>
          <ToolCallsSection tools={msg.toolsUsed} />
        </div>
      )}

      {/* Follow-up questions */}
      {!isUser && !isError && msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
        <div style={{ maxWidth: '78%', marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {msg.followUpQuestions.map(q => (
            <button
              key={q}
              onClick={() => onFollowUp(q)}
              style={{
                padding: '4px 12px', borderRadius: 100, fontSize: 12, cursor: 'pointer',
                background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
                color: '#8B5CF6', fontWeight: 500,
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function NLQueryClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiNotConfigured, setAiNotConfigured] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Build conversation history (last 10 messages)
    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    try {
      const res = await fetch('/api/mcp/nl-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed, history, stream: false }),
      })

      if (res.status === 503 || res.status === 400) {
        const data = await res.json() as { error?: string }
        if (data.error?.includes('not configured') || data.error?.includes('API key')) {
          setAiNotConfigured(true)
        }
        throw new Error(data.error ?? 'Request failed')
      }

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }

      const data = await res.json() as NLQueryResponse

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer,
        toolsUsed: data.toolsUsed,
        confidence: data.confidence,
        followUpQuestions: data.followUpQuestions,
      }

      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'error',
        content: err instanceof Error ? err.message : 'An unexpected error occurred.',
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [loading, messages])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)',
      maxWidth: 860, margin: '0 auto',
    }}>

      {/* Header */}
      <div style={{ marginBottom: 20, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={18} color="#8B5CF6" />
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            AI GRC Assistant
          </h1>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, paddingLeft: 52 }}>
          Ask anything about your compliance posture, findings, risks, or tasks.
        </p>
      </div>

      {/* AI not configured banner */}
      {aiNotConfigured && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: 10, flexShrink: 0,
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertCircle size={14} color="#FBBF24" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'rgba(251,191,36,0.9)', flex: 1 }}>
            AI provider is not configured.
          </span>
          <a
            href="/settings/ai"
            style={{
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
              color: '#FBBF24', textDecoration: 'none',
              padding: '4px 10px', borderRadius: 6,
              background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)',
            }}
          >
            <Settings size={12} />
            Configure AI
          </a>
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '8px 0', marginBottom: 16,
      }}>
        {isEmpty && (
          <div style={{ paddingTop: 32 }}>
            {/* Empty state: suggestions */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18, margin: '0 auto 16px',
                background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(6,182,212,0.15))',
                border: '1px solid rgba(139,92,246,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={28} color="#8B5CF6" />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                Ask me about your compliance
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 440, margin: '0 auto', lineHeight: 1.6 }}>
                I can query your frameworks, findings, tasks, and evidence in real-time to answer your questions.
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {SUGGESTED_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  style={{
                    padding: '8px 16px', borderRadius: 100, fontSize: 13, cursor: 'pointer',
                    background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
                    color: '#8B5CF6', fontWeight: 500,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(139,92,246,0.15)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(139,92,246,0.08)'
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onFollowUp={sendMessage}
          />
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{
              padding: '12px 16px', borderRadius: '16px 16px 16px 4px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Loader2 size={14} color="var(--violet)" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{
        flexShrink: 0, padding: '12px 16px', borderRadius: 16,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
        display: 'flex', gap: 10, alignItems: 'flex-end',
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your compliance... (Enter to send)"
          rows={1}
          disabled={loading}
          style={{
            flex: 1, resize: 'none', border: 'none', outline: 'none',
            background: 'transparent', color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.6,
            minHeight: 24, maxHeight: 120,
          }}
          onInput={e => {
            const t = e.currentTarget
            t.style.height = 'auto'
            t.style.height = `${Math.min(t.scrollHeight, 120)}px`
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: input.trim() && !loading
              ? 'linear-gradient(135deg, #8B5CF6, #7C3AED)'
              : 'rgba(255,255,255,0.06)',
            border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
        >
          {loading
            ? <Loader2 size={16} color="var(--text-muted)" style={{ animation: 'spin 1s linear infinite' }} />
            : <Send size={16} color={input.trim() ? 'white' : 'var(--text-muted)'} />
          }
        </button>
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 8, flexShrink: 0 }}>
        AI responses are based on your live compliance data. Always verify critical decisions.
      </p>
    </div>
  )
}
