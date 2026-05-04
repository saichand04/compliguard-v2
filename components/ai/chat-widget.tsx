'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Bot, X, Send, ExternalLink, Sparkles } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

// Simple inline markdown renderer — no external libs
function renderMarkdown(content: string): string {
  let html = content
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
  html = html.replace(/\n\n/g, '<br/><br/>')
  html = html.replace(/\n/g, '<br/>')
  return html
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [convId, setConvId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  const sendMessage = async (msgText?: string) => {
    const text = (msgText || input).trim()
    if (!text || isStreaming) return

    setInput('')
    const userMsg: Message = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])

    const aiMsg: Message = { role: 'assistant', content: '', streaming: true }
    setMessages((prev) => [...prev, aiMsg])
    setIsStreaming(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId: convId }),
        signal: ctrl.signal,
      })

      if (!res.body) throw new Error('No body')

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buffer = ''

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
              if (!convId) setConvId(parsed.conversationId)
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
            // Skip
          }
        }
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
    ta.style.height = Math.min(ta.scrollHeight, 80) + 'px'
  }, [input])

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 900,
          boxShadow: '0 4px 20px rgba(124,58,237,0.5)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)'
          e.currentTarget.style.boxShadow = '0 6px 28px rgba(124,58,237,0.65)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,58,237,0.5)'
        }}
        aria-label="Open AI Assistant"
        title="AI Assistant"
      >
        {open ? <X size={20} color="#fff" /> : <Bot size={22} color="#fff" />}
      </button>

      {/* Chat popover */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 86,
            right: 24,
            width: 400,
            height: 500,
            background: 'rgba(12,14,28,0.96)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 899,
            backdropFilter: 'blur(24px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.15)',
            animation: 'widget-in 0.2s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={14} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                CompliGuard AI
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                Compliance Assistant
              </div>
            </div>
            <Link
              href="/ai-assistant"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                color: '#8B5CF6',
                textDecoration: 'none',
                padding: '4px 8px',
                background: 'rgba(139,92,246,0.1)',
                borderRadius: 6,
                border: '1px solid rgba(139,92,246,0.2)',
              }}
            >
              <ExternalLink size={10} />
              Full Chat
            </Link>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {messages.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: '20px 10px',
                  textAlign: 'center',
                }}
              >
                <Bot size={28} color="rgba(139,92,246,0.5)" />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>
                  Ask me anything about compliance
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                  {[
                    'What controls am I missing?',
                    'Show my open findings',
                    'Summarize compliance posture',
                  ].map((p) => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      disabled={isStreaming}
                      style={{
                        padding: '7px 12px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.6)',
                        textAlign: 'left',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(139,92,246,0.1)'
                        e.currentTarget.style.borderColor = 'rgba(139,92,246,0.25)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
                      }}
                    >
                      {p}
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
                  }}
                >
                  <div
                    style={{
                      maxWidth: '85%',
                      padding: '8px 12px',
                      background:
                        msg.role === 'user'
                          ? 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)'
                          : 'rgba(255,255,255,0.06)',
                      border:
                        msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius:
                        msg.role === 'user' ? '10px 10px 3px 10px' : '3px 10px 10px 10px',
                      fontSize: 12.5,
                      lineHeight: 1.5,
                      color: 'rgba(255,255,255,0.9)',
                    }}
                  >
                    {msg.role === 'user' ? (
                      <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                    ) : msg.streaming && msg.content === '' ? (
                      <WidgetTyping />
                    ) : (
                      <>
                        <div
                          className="widget-md"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                        />
                        {msg.streaming && (
                          <span
                            style={{
                              display: 'inline-block',
                              width: 6,
                              height: 12,
                              background: '#8B5CF6',
                              borderRadius: 2,
                              marginLeft: 2,
                              verticalAlign: 'middle',
                              animation: 'blink 0.8s step-end infinite',
                            }}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: '8px 10px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 7,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 10,
                padding: '6px 10px',
              }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about compliance..."
                rows={1}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  resize: 'none',
                  minHeight: 20,
                  maxHeight: 80,
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isStreaming}
                style={{
                  width: 28,
                  height: 28,
                  background:
                    input.trim() && !isStreaming
                      ? 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)'
                      : 'rgba(255,255,255,0.05)',
                  border: 'none',
                  borderRadius: 7,
                  cursor: input.trim() && !isStreaming ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                }}
              >
                <Send
                  size={12}
                  color={
                    input.trim() && !isStreaming ? '#fff' : 'rgba(255,255,255,0.3)'
                  }
                />
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes widget-in {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes typing-dot { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-3px); opacity: 1; } }
        .widget-md strong { font-weight: 700; }
        .widget-md em { font-style: italic; }
        .widget-md code { background: rgba(139,92,246,0.15); padding: 0 4px; border-radius: 3px; font-family: monospace; font-size: 11.5px; color: #a78bfa; }
        .widget-md pre { background: rgba(0,0,0,0.3); border-radius: 6px; padding: 8px; overflow-x: auto; margin: 4px 0; }
        .widget-md pre code { background: none; padding: 0; }
        .widget-md ul { padding-left: 16px; margin: 4px 0; }
        .widget-md li { margin-bottom: 2px; }
      `}</style>
    </>
  )
}

function WidgetTyping() {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center', padding: '1px 0' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 5,
            height: 5,
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
