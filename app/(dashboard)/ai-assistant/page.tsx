'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send, Plus, Trash2, MessageSquare, Sparkles, Paperclip, Bot,
  ChevronDown, ChevronUp, Loader2, AlertCircle, Settings, Wrench, Database,
  ShieldCheck, BarChart3, ListTodo, AlertTriangle,
} from 'lucide-react'

// ─── Shared markdown renderer ────────────────────────────────────────────────
function renderMarkdown(content: string): string {
  let html = content
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
  html = html.replace(/\n\n/g, '</p><p>')
  html = html.replace(/\n/g, '<br/>')
  html = `<p>${html}</p>`
  html = html.replace(/<p><\/p>/g, '')
  html = html.replace(/<p>(<h[1-3]>)/g, '$1').replace(/(<\/h[1-3]>)<\/p>/g, '$1')
  html = html.replace(/<p>(<ul>)/g, '$1').replace(/(<\/ul>)<\/p>/g, '$1')
  html = html.replace(/<p>(<pre>)/g, '$1').replace(/(<\/pre>)<\/p>/g, '$1')
  return html
}

function formatTime(ts: string) {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}
function formatDate(ts: string) {
  try {
    const diff = Date.now() - new Date(ts).getTime()
    if (diff < 86400000) return 'Today'
    if (diff < 172800000) return 'Yesterday'
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })
  } catch { return '' }
}

// ─── Mode toggle pill ────────────────────────────────────────────────────────
type Mode = 'chat' | 'query'

function ModePill({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div style={{
      display: 'inline-flex',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: 100,
      padding: 3,
      gap: 2,
    }}>
      {(['chat', 'query'] as Mode[]).map(m => {
        const active = mode === m
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 18px', borderRadius: 100, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: active ? 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)' : 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,0.38)',
              transition: 'all 0.2s ease',
              boxShadow: active ? '0 2px 12px rgba(124,58,237,0.45)' : 'none',
              letterSpacing: '0.01em',
            }}
          >
            {m === 'chat' ? <Bot size={12} /> : <Database size={12} />}
            {m === 'chat' ? 'AI Chat' : 'Data Query'}
          </button>
        )
      })}
    </div>
  )
}

// ─── Chat mode ───────────────────────────────────────────────────────────────
interface ChatMessage { role: 'user' | 'assistant'; content: string; timestamp: string; streaming?: boolean }
interface Conversation { id: string; dbId: string; title: string; preview: string; messageCount: number; updatedAt: string }

const CHAT_PROMPTS = [
  { text: 'What controls am I missing for SOC 2?', icon: ShieldCheck },
  { text: 'Show me evidence gaps for ISO 27001', icon: ListTodo },
  { text: 'Summarize my current compliance posture', icon: BarChart3 },
  { text: 'What are my highest priority findings?', icon: AlertTriangle },
]

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: '50%', background: '#8B5CF6',
          display: 'inline-block',
          animation: 'typing-dot 1.2s ease-in-out infinite',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </div>
  )
}

function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/conversations')
      if (res.ok) { const d = await res.json(); setConversations(d.conversations || []) }
    } catch { /* ignore */ } finally { setLoadingConvs(false) }
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    const ta = textareaRef.current; if (!ta) return
    ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [input])

  const loadConversation = async (convId: string) => {
    try {
      const res = await fetch(`/api/ai/conversations/${convId}`)
      if (res.ok) { const d = await res.json(); setMessages(d.messages || []); setActiveConvId(convId) }
    } catch { /* ignore */ }
  }

  const startNewChat = () => {
    setMessages([]); setActiveConvId(null); setInput('')
    if (abortRef.current) abortRef.current.abort()
  }

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try { await fetch(`/api/ai/conversations/${convId}`, { method: 'DELETE' }) } catch { /* ignore */ }
    if (activeConvId === convId) startNewChat()
    setConversations(prev => prev.filter(c => c.id !== convId))
  }

  const sendMessage = async (msgText?: string) => {
    const text = (msgText || input).trim()
    if (!text || isStreaming) return
    setInput('')
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: new Date().toISOString(), streaming: true }])
    setIsStreaming(true)
    const ctrl = new AbortController(); abortRef.current = ctrl
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId: activeConvId }),
        signal: ctrl.signal,
      })
      if (!res.body) throw new Error('No response body')
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buffer = ''; let newConvId: string | null = null
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buffer += dec.decode(value, { stream: true })
        const lines = buffer.split('\n'); buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim(); if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'token') {
              setMessages(prev => { const n = [...prev]; const l = n[n.length - 1]; if (l?.role === 'assistant') n[n.length - 1] = { ...l, content: l.content + parsed.content }; return n })
            } else if (parsed.type === 'done') {
              newConvId = parsed.conversationId
              setMessages(prev => { const n = [...prev]; const l = n[n.length - 1]; if (l?.role === 'assistant') n[n.length - 1] = { ...l, streaming: false }; return n })
            } else if (parsed.type === 'error') {
              setMessages(prev => { const n = [...prev]; const l = n[n.length - 1]; if (l?.role === 'assistant') n[n.length - 1] = { ...l, content: `Error: ${parsed.content}`, streaming: false }; return n })
            }
          } catch { /* skip malformed */ }
        }
      }
      if (newConvId && !activeConvId) { setActiveConvId(newConvId); await loadConversations() }
      else if (activeConvId) { await loadConversations() }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setMessages(prev => { const n = [...prev]; const l = n[n.length - 1]; if (l?.role === 'assistant') n[n.length - 1] = { ...l, content: 'Connection error. Please try again.', streaming: false }; return n })
    } finally { setIsStreaming(false) }
  }

  const isEmpty = messages.length === 0

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Left sidebar ── */}
      <aside style={{
        width: 248, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: '#0B0C10',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Sidebar ambient glow */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: 120,
          background: 'rgba(79,70,229,0.06)',
          filter: 'blur(32px)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        {/* Title block */}
        <div style={{ padding: '18px 14px 13px', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 34, height: 34,
              background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: '0 4px 12px rgba(124,58,237,0.35)',
            }}>
              <Bot size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.92)', lineHeight: 1.2 }}>CompliGuard AI</div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.32)', marginTop: 1 }}>GRC Expert</div>
            </div>
          </div>

          {/* New Chat button */}
          <button onClick={startNewChat} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '9px 12px',
            background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
            border: 'none', borderRadius: 9, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            transition: 'opacity 0.15s',
            boxShadow: '0 2px 10px rgba(124,58,237,0.3)',
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <Plus size={14} /> New Chat
          </button>
        </div>

        {/* Recent conversations */}
        <div style={{ padding: '10px 12px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', position: 'relative', zIndex: 1 }}>Recent</div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 8px', position: 'relative', zIndex: 1 }}>
          {loadingConvs ? (
            <div style={{ padding: 12, fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>Loading...</div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: '16px 10px', fontSize: 12, color: 'rgba(255,255,255,0.28)', textAlign: 'center' }}>No conversations yet</div>
          ) : conversations.map(conv => (
            <button key={conv.id} onClick={() => loadConversation(conv.id)} style={{
              width: '100%', display: 'flex', alignItems: 'flex-start', gap: 7, padding: '8px 8px',
              background: activeConvId === conv.id ? 'rgba(124,58,237,0.14)' : 'transparent',
              border: activeConvId === conv.id ? '1px solid rgba(124,58,237,0.28)' : '1px solid transparent',
              borderRadius: 8, cursor: 'pointer', textAlign: 'left', marginBottom: 1,
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { if (activeConvId !== conv.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
              onMouseLeave={e => { if (activeConvId !== conv.id) e.currentTarget.style.background = 'transparent' }}
            >
              <MessageSquare size={12} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.78)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.title}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.27)', marginTop: 1 }}>{formatDate(conv.updatedAt)}</div>
              </div>
              <button onClick={e => deleteConversation(conv.id, e)} style={{
                padding: 2, background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.18)', borderRadius: 4, display: 'flex', alignItems: 'center',
              }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.75)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.18)')}
              ><Trash2 size={10} /></button>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Right main panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, position: 'relative', background: '#090A0F' }}>

        {/* Messages / empty state area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isEmpty ? '0' : '24px 10%', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Empty state ── */}
          {isEmpty && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 5%' }}>

              {/* Welcome header */}
              <div style={{ textAlign: 'center', marginBottom: 36 }}>
                <div style={{
                  width: 62, height: 62,
                  background: 'rgba(79,70,229,0.1)',
                  border: '1px solid rgba(124,58,237,0.22)',
                  borderRadius: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 18px',
                  boxShadow: '0 0 32px rgba(79,70,229,0.12)',
                }}>
                  <Sparkles size={27} color="#8B5CF6" />
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.93)', margin: '0 0 0 0', letterSpacing: '-0.02em' }}>How can I help you today?</h2>
              </div>

              {/* Input box — Gemini style */}
              <div style={{ width: '100%', maxWidth: 700 }}>
                <div style={{
                  background: '#151822',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 24,
                  overflow: 'hidden',
                  boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
                  transition: 'border-color 0.2s',
                }}
                  onFocusCapture={e => (e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)')}
                  onBlurCapture={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
                >
                  {/* Textarea row */}
                  <div style={{ padding: '14px 18px 8px' }}>
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                      placeholder="Ask about compliance, controls, risk findings…"
                      rows={1}
                      style={{
                        width: '100%', background: 'transparent', border: 'none', outline: 'none',
                        color: 'rgba(255,255,255,0.9)', fontSize: 14.5, lineHeight: 1.55,
                        resize: 'none', minHeight: 26, maxHeight: 120, fontFamily: 'inherit',
                      }}
                    />
                  </div>
                  {/* Action toolbar row */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px 10px', gap: 6 }}>
                    <button style={{ padding: '6px 7px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.22)', borderRadius: 8, display: 'flex', alignItems: 'center' }} title="Attach file (coming soon)">
                      <Paperclip size={15} />
                    </button>
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.01em' }}>↵ to send</span>
                    <button
                      onClick={() => sendMessage()}
                      disabled={!input.trim() || isStreaming}
                      style={{
                        width: 34, height: 34,
                        background: input.trim() && !isStreaming
                          ? 'linear-gradient(135deg, #7C3AED, #4F46E5)'
                          : 'rgba(255,255,255,0.05)',
                        border: 'none', borderRadius: 10,
                        cursor: input.trim() && !isStreaming ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        transition: 'all 0.15s',
                        boxShadow: input.trim() && !isStreaming ? '0 2px 8px rgba(124,58,237,0.4)' : 'none',
                      }}
                    >
                      <Send size={14} color={input.trim() && !isStreaming ? '#fff' : 'rgba(255,255,255,0.25)'} />
                    </button>
                  </div>
                </div>

                {/* Suggestion chips — 2-column grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
                  {CHAT_PROMPTS.map(p => {
                    const Icon = p.icon
                    return (
                      <button
                        key={p.text}
                        onClick={() => sendMessage(p.text)}
                        disabled={isStreaming}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '11px 14px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: 12,
                          cursor: 'pointer', textAlign: 'left',
                          fontSize: 12.5, color: 'rgba(255,255,255,0.65)',
                          lineHeight: 1.4, transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(124,58,237,0.09)'
                          e.currentTarget.style.borderColor = 'rgba(124,58,237,0.28)'
                          e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
                          e.currentTarget.style.color = 'rgba(255,255,255,0.65)'
                        }}
                      >
                        {/* Icon container */}
                        <div style={{
                          width: 28, height: 28,
                          background: 'rgba(124,58,237,0.12)',
                          border: '1px solid rgba(124,58,237,0.2)',
                          borderRadius: 7,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Icon size={13} color="#8B5CF6" />
                        </div>
                        <span style={{ flex: 1 }}>{p.text}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {!isEmpty && messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 9, alignItems: 'flex-start' }}>
              {msg.role === 'assistant' && (
                <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, boxShadow: '0 2px 8px rgba(124,58,237,0.3)' }}>
                  <Bot size={13} color="#fff" />
                </div>
              )}
              <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: 3, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  padding: msg.role === 'user' ? '10px 15px' : '12px 16px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #7C3AED, #4F46E5)'
                    : 'rgba(255,255,255,0.05)',
                  border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
                  fontSize: 13.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.92)',
                  boxShadow: msg.role === 'user' ? '0 2px 12px rgba(124,58,237,0.25)' : 'none',
                }}>
                  {msg.role === 'user' ? (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                  ) : msg.streaming && msg.content === '' ? <TypingIndicator /> : (
                    <div className="ai-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                  )}
                  {msg.role === 'assistant' && msg.streaming && msg.content !== '' && (
                    <span style={{ display: 'inline-block', width: 6, height: 13, background: '#8B5CF6', borderRadius: 2, marginLeft: 2, verticalAlign: 'middle', animation: 'blink 0.8s step-end infinite' }} />
                  )}
                </div>
                {msg.timestamp && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', paddingLeft: msg.role === 'assistant' ? 3 : 0, paddingRight: msg.role === 'user' ? 3 : 0 }}>{formatTime(msg.timestamp)}</div>}
              </div>
              {msg.role === 'user' && (
                <div style={{ width: 28, height: 28, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 700 }}>U</div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Sticky input — shown during active conversation ── */}
        {!isEmpty && (
          <div style={{ padding: '10px 14px 14px', flexShrink: 0, background: '#090A0F', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{
              background: '#151822',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 20,
              overflow: 'hidden',
              maxWidth: 860, margin: '0 auto',
              transition: 'border-color 0.2s',
            }}
              onFocusCapture={e => (e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)')}
              onBlurCapture={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
            >
              <div style={{ padding: '12px 16px 6px' }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="Ask about compliance, controls, findings…"
                  rows={1}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'rgba(255,255,255,0.9)', fontSize: 13.5, lineHeight: 1.5, resize: 'none', minHeight: 22, maxHeight: 120, fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 8px', gap: 4 }}>
                <button style={{ padding: '5px 6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.2)', borderRadius: 7, display: 'flex', alignItems: 'center' }} title="Attach file (coming soon)">
                  <Paperclip size={14} />
                </button>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.18)' }}>↵ to send</span>
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isStreaming}
                  style={{
                    width: 32, height: 32,
                    background: input.trim() && !isStreaming ? 'linear-gradient(135deg, #7C3AED, #4F46E5)' : 'rgba(255,255,255,0.05)',
                    border: 'none', borderRadius: 9,
                    cursor: input.trim() && !isStreaming ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    transition: 'all 0.15s',
                  }}
                >
                  <Send size={13} color={input.trim() && !isStreaming ? '#fff' : 'rgba(255,255,255,0.25)'} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Data Query mode ─────────────────────────────────────────────────────────
interface ToolCall { tool: string; args: Record<string, unknown>; result: string }
interface NLQueryResponse { answer: string; toolsUsed: ToolCall[]; confidence: 'high' | 'medium' | 'low'; followUpQuestions?: string[] }
type QueryRole = 'user' | 'assistant' | 'error'
interface QueryMessage { id: string; role: QueryRole; content: string; toolsUsed?: ToolCall[]; confidence?: 'high' | 'medium' | 'low'; followUpQuestions?: string[] }

const QUERY_SUGGESTIONS = [
  "What's our compliance score?", 'Show critical findings',
  'What are our biggest risks?', 'Which tasks are overdue?',
]

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const colors = { high: { bg: 'rgba(74,222,128,0.1)', text: '#4ADE80', border: 'rgba(74,222,128,0.2)' }, medium: { bg: 'rgba(251,191,36,0.1)', text: '#FBBF24', border: 'rgba(251,191,36,0.2)' }, low: { bg: 'rgba(239,68,68,0.1)', text: '#EF4444', border: 'rgba(239,68,68,0.2)' } }
  const c = colors[confidence]
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 100, background: c.bg, color: c.text, border: `1px solid ${c.border}`, letterSpacing: '0.04em', textTransform: 'capitalize' }}>{confidence} confidence</span>
}

function ToolCallsSection({ tools }: { tools: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false)
  if (tools.length === 0) return null
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setExpanded(x => !x)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: 11.5, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
        <Wrench size={11} />{tools.length} tool{tools.length > 1 ? 's' : ''} used
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {expanded && (
        <div style={{ marginTop: 6, borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', fontSize: 12 }}>
          {tools.map((tc, i) => (
            <div key={i} style={{ padding: '10px 14px', borderBottom: i < tools.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#8B5CF6', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', padding: '2px 7px', borderRadius: 4 }}>{tc.tool}</span>
              {Object.keys(tc.args).length > 0 && <div style={{ marginTop: 4 }}><span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Args: </span><code style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{JSON.stringify(tc.args)}</code></div>}
              <details style={{ marginTop: 4 }}><summary style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: 11, listStyle: 'none' }}>▶ View result</summary>
                <pre style={{ marginTop: 6, padding: 10, borderRadius: 6, fontSize: 10, background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.6)', overflow: 'auto', maxHeight: 200, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{tc.result}</pre>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function QueryPanel() {
  const [messages, setMessages] = useState<QueryMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiNotConfigured, setAiNotConfigured] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendQuery = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: trimmed }])
    setInput(''); setLoading(true)
    const history = messages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-10).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    try {
      const res = await fetch('/api/mcp/nl-query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: trimmed, history, stream: false }) })
      if (res.status === 503 || res.status === 400) {
        const d = await res.json() as { error?: string }
        if (d.error?.includes('not configured') || d.error?.includes('API key')) setAiNotConfigured(true)
        throw new Error(d.error ?? 'Request failed')
      }
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error ?? `HTTP ${res.status}`) }
      const d = await res.json() as NLQueryResponse
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: d.answer, toolsUsed: d.toolsUsed, confidence: d.confidence, followUpQuestions: d.followUpQuestions }])
    } catch (err) {
      setMessages(prev => [...prev, { id: (Date.now() + 2).toString(), role: 'error', content: err instanceof Error ? err.message : 'An unexpected error occurred.' }])
    } finally { setLoading(false); setTimeout(() => inputRef.current?.focus(), 100) }
  }, [loading, messages])

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Left spacer sidebar (matches chat sidebar width for visual alignment) */}
      <aside style={{
        width: 248, flexShrink: 0,
        background: '#0B0C10',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        padding: '20px 14px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Sidebar glow */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 120, background: 'rgba(6,182,212,0.05)', filter: 'blur(32px)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #06B6D4, #0891B2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(6,182,212,0.3)' }}>
              <Database size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.92)', lineHeight: 1.2 }}>Data Query</div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.32)', marginTop: 1 }}>Live GRC data</div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', lineHeight: 1.6, marginBottom: 16 }}>
            Query your live compliance data — frameworks, findings, tasks, and risks — in real-time.
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', marginBottom: 10 }}>Try asking</div>
            {QUERY_SUGGESTIONS.map(q => (
              <button key={q} onClick={() => sendQuery(q)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 10px', marginBottom: 5,
                background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.14)',
                borderRadius: 8, cursor: 'pointer', fontSize: 11.5, color: 'rgba(6,182,212,0.8)', lineHeight: 1.4, transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(6,182,212,0.12)'; e.currentTarget.style.borderColor = 'rgba(6,182,212,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(6,182,212,0.06)'; e.currentTarget.style.borderColor = 'rgba(6,182,212,0.14)' }}
              >{q}</button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main query area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#090A0F' }}>

        {aiNotConfigured && (
          <div style={{ margin: '14px 20px 0', padding: '10px 14px', borderRadius: 10, flexShrink: 0, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={13} color="#FBBF24" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: 'rgba(251,191,36,0.9)', flex: 1 }}>AI provider is not configured.</span>
            <a href="/settings/ai" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#FBBF24', textDecoration: 'none', padding: '4px 10px', borderRadius: 6, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}><Settings size={12} />Configure AI</a>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 14px' }}>
          {messages.length === 0 && (
            <div style={{ paddingTop: 60, textAlign: 'center' }}>
              <div style={{ width: 58, height: 58, borderRadius: 16, margin: '0 auto 16px', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 28px rgba(6,182,212,0.1)' }}>
                <Database size={24} color="#06B6D4" />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 8, letterSpacing: '-0.01em' }}>Query your live compliance data</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', maxWidth: 400, margin: '0 auto', lineHeight: 1.7 }}>
                Ask questions in plain English — I query your frameworks, findings, tasks, and risks in real-time.
              </p>
            </div>
          )}

          {messages.map(msg => {
            const isUser = msg.role === 'user'; const isError = msg.role === 'error'
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: 14 }}>
                <div style={{ maxWidth: '78%', padding: '11px 15px', borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: isUser ? 'linear-gradient(135deg, #7C3AED, #4F46E5)' : isError ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.05)', border: isUser ? 'none' : isError ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.07)', color: isUser ? 'white' : isError ? '#EF4444' : 'rgba(255,255,255,0.9)', fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {isError && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}><AlertCircle size={12} /><span style={{ fontSize: 12, fontWeight: 600 }}>Error</span></div>}
                  {msg.content}
                </div>
                {!isUser && !isError && msg.toolsUsed && (
                  <div style={{ maxWidth: '78%', marginTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>{msg.confidence && <ConfidenceBadge confidence={msg.confidence} />}</div>
                    <ToolCallsSection tools={msg.toolsUsed} />
                  </div>
                )}
                {!isUser && !isError && msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
                  <div style={{ maxWidth: '78%', marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {msg.followUpQuestions.map(q => (
                      <button key={q} onClick={() => sendQuery(q)} style={{ padding: '4px 12px', borderRadius: 100, fontSize: 12, cursor: 'pointer', background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', color: '#06B6D4', fontWeight: 500 }}>{q}</button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ padding: '11px 15px', borderRadius: '14px 14px 14px 4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Loader2 size={13} color="#06B6D4" style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Querying your data...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Query input */}
        <div style={{ padding: '10px 20px 14px', flexShrink: 0, background: '#090A0F', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{
            background: '#151822', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20,
            overflow: 'hidden', maxWidth: 860, margin: '0 auto', transition: 'border-color 0.2s',
          }}
            onFocusCapture={e => (e.currentTarget.style.borderColor = 'rgba(6,182,212,0.45)')}
            onBlurCapture={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
          >
            <div style={{ padding: '12px 16px 6px' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery(input) } }}
                placeholder="Ask anything about your compliance data…"
                rows={1} disabled={loading}
                style={{ width: '100%', resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: 'rgba(255,255,255,0.9)', fontSize: 13.5, lineHeight: 1.6, minHeight: 24, maxHeight: 120, fontFamily: 'inherit' }}
                onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight, 120)}px` }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 8px', gap: 4 }}>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.18)' }}>↵ to send</span>
              <button
                onClick={() => sendQuery(input)}
                disabled={loading || !input.trim()}
                style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: input.trim() && !loading ? 'linear-gradient(135deg, #06B6D4, #0891B2)' : 'rgba(255,255,255,0.06)',
                  border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
              >
                {loading
                  ? <Loader2 size={14} color="rgba(255,255,255,0.35)" style={{ animation: 'spin 1s linear infinite' }} />
                  : <Send size={14} color={input.trim() ? 'white' : 'rgba(255,255,255,0.25)'} />}
              </button>
            </div>
          </div>
          <p style={{ textAlign: 'center', fontSize: 10.5, color: 'rgba(255,255,255,0.2)', marginTop: 7, marginBottom: 0 }}>AI responses are based on your live compliance data. Always verify critical decisions.</p>
        </div>
      </div>
    </div>
  )
}

// ─── Unified page ────────────────────────────────────────────────────────────
export default function AIAssistantPage() {
  const [mode, setMode] = useState<Mode>('chat')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px - 48px)', overflow: 'hidden', position: 'relative' }}>

      {/* Floating mode pill — absolutely centered at top of main content */}
      <div style={{
        position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
        zIndex: 20, pointerEvents: 'auto',
      }}>
        <ModePill mode={mode} onChange={setMode} />
      </div>

      {/* Panel — fills full height, pill floats above */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {mode === 'chat' ? <ChatPanel /> : <QueryPanel />}
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
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
