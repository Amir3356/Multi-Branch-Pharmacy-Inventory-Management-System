import { useEffect, useRef, useState } from 'react'
import { Loader2, RotateCcw, Send, Sparkles } from 'lucide-react'
import { askAssistant } from '../../../api/aiApi'

// The conversation sent with each question: the latest turns only, so requests stay small
const HISTORY_SENT = 12

// **bold** inside a line of the assistant's plain-text answer
const withBold = (text) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part))

// The assistant answers in short paragraphs and "- " lists
function AnswerText({ text }) {
  const blocks = []
  for (const line of text.split('\n')) {
    const item = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/)
    if (item) {
      const last = blocks[blocks.length - 1]
      if (last?.type === 'list') last.items.push(item[1])
      else blocks.push({ type: 'list', items: [item[1]] })
    } else if (line.trim()) {
      blocks.push({ type: 'p', text: line.trim() })
    }
  }
  return blocks.map((block, i) =>
    block.type === 'list' ? (
      <ul key={i}>{block.items.map((it, j) => <li key={j}>{withBold(it)}</li>)}</ul>
    ) : (
      <p key={i}>{withBold(block.text)}</p>
    )
  )
}

// Chat with the role's assistant. `storageKey` keeps the conversation for this browser tab.
export default function AssistantChat({ suggestions, storageKey }) {
  const [messages, setMessages] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey)) || []
    } catch {
      return []
    }
  })
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const listRef = useRef(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages))
    } catch {
      // Storage unavailable (private window): the conversation just isn't kept
    }
  }, [messages, storageKey])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  const send = async (text) => {
    const question = text.trim()
    if (!question || sending) return
    const next = [...messages, { role: 'user', content: question }]
    setMessages(next)
    setInput('')
    setError(null)
    setSending(true)
    try {
      const { data } = await askAssistant(next.slice(-HISTORY_SENT))
      setMessages((current) => [...current, { role: 'assistant', content: data.reply }])
    } catch (err) {
      // Take the unanswered question back into the box so it can be sent again
      setMessages((current) => current.slice(0, -1))
      setInput(question)
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send(input)
    }
  }

  return (
    <section className="ai-chat" aria-label="Ask the assistant">
      <div className="ai-chat-header">
        <h3>
          <Sparkles size={16} /> Ask the assistant
        </h3>
        {messages.length > 0 && (
          <button type="button" className="link-btn" onClick={() => setMessages([])} disabled={sending}>
            <RotateCcw size={13} /> New chat
          </button>
        )}
      </div>

      <div className="ai-chat-messages" ref={listRef} aria-live="polite">
        {messages.length === 0 && (
          <div className="ai-chat-intro">
            <p>Ask about your figures. Try one of these:</p>
            <div className="ai-suggestions">
              {suggestions.map((q) => (
                <button key={q} type="button" className="ai-suggestion" onClick={() => send(q)} disabled={sending}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`ai-message ${m.role}`}>
            {m.role === 'assistant' ? <AnswerText text={m.content} /> : m.content}
          </div>
        ))}
        {sending && (
          <div className="ai-message assistant ai-thinking">
            <Loader2 size={14} className="ai-spin" /> Thinking…
          </div>
        )}
      </div>

      {error && <p className="ai-chat-error">{error}</p>}

      <form
        className="ai-chat-form"
        onSubmit={(event) => {
          event.preventDefault()
          send(input)
        }}
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question…"
          rows={2}
          maxLength={2000}
          aria-label="Your question"
        />
        <button type="submit" className="primary-action-btn" disabled={sending || !input.trim()} aria-label="Send">
          <Send size={16} />
        </button>
      </form>
      <p className="ai-chat-note">Answers come from an AI and can be wrong. Check important figures in their own pages.</p>
    </section>
  )
}
