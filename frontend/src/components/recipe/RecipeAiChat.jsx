import { useEffect, useRef, useState } from 'react'
import { askAboutRecipe } from '../../services/gemini.js'
import { draftKey, useSessionDraft } from '../../hooks/useSessionDraft.js'
import { AiRichText } from './AiRichText.jsx'

const SUGGESTIONS = [
  'Come la conservo e per quanto?',
  'Posso farla in friggitrice ad aria?',
  'Come la rendo più leggera?',
  'Sostituzioni se manca un ingrediente?'
]

export default function RecipeAiChat({ recipeId, recipeTitle, open, onClose }) {
  const chatKey = draftKey(`recipe-chat:${recipeId}`)
  const {
    value: rawMessages,
    setValue: setMessages,
    clear
  } = useSessionDraft(chatKey, [])

  const messages = Array.isArray(rawMessages) ? rawMessages : []
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 120)
    }
  }, [open, messages, sending])

  if (!open) return null

  const send = async (text) => {
    const q = String(text || '').trim()
    if (!q || sending) return
    setError(null)
    const next = [...messages, { role: 'user', text: q }]
    setMessages(next)
    setInput('')
    setSending(true)
    try {
      const res = await askAboutRecipe(recipeId, next)
      setMessages([...next, { role: 'model', text: res.data.reply }])
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    send(input)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-stone-900/45 backdrop-blur-[2px] animate-fade-in"
        aria-label="Chiudi chat"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Chiedi ad IA su ${recipeTitle}`}
        className="relative w-full sm:max-w-xl max-h-[92vh] sm:max-h-[84vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up border border-stone-200/80"
      >
        <div className="shrink-0 px-5 pt-4 pb-3 bg-gradient-to-br from-orange-50 via-white to-teal-50/40 border-b border-stone-100">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-200 sm:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.14em] text-primary font-semibold mb-1">
                Assistente cucina
              </p>
              <h2 className="font-display text-xl text-stone-900 leading-tight">Chiedi all’IA</h2>
              <p className="text-sm text-stone-500 mt-0.5 truncate">{recipeTitle}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  className="text-xs font-medium text-stone-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-white/80"
                  onClick={() => {
                    clear()
                    setMessages([])
                  }}
                >
                  Pulisci
                </button>
              )}
              <button
                type="button"
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-stone-200 text-stone-600 hover:text-stone-900 hover:border-stone-300"
                onClick={onClose}
                aria-label="Chiudi"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4 bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_40%)]">
          {messages.length === 0 && (
            <div className="space-y-4 pt-1">
              <p className="text-sm text-stone-500 leading-relaxed max-w-md">
                Conservazione, cotture alternative, sostituzioni, versioni più leggere — chiedi pure.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="text-left text-sm px-3.5 py-3 rounded-2xl bg-white border border-stone-200 shadow-sm text-stone-700 hover:border-primary/35 hover:shadow-md transition-all"
                    onClick={() => send(s)}
                    disabled={sending}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'user' ? (
                <div className="max-w-[88%] rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-relaxed bg-primary text-white shadow-sm">
                  {m.text}
                </div>
              ) : (
                <div className="max-w-[94%] rounded-2xl rounded-bl-md px-4 py-3.5 bg-white border border-stone-100 shadow-sm">
                  <AiRichText text={m.text} />
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-sm text-stone-400">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:300ms]" />
              </span>
              Sto preparando la risposta…
            </div>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2" role="alert">
              {error}
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="shrink-0 p-3 sm:p-4 border-t border-stone-100 bg-white flex gap-2 items-end"
        >
          <input
            ref={inputRef}
            className="input-field flex-1 !py-3 !rounded-2xl"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Scrivi una domanda…"
            disabled={sending}
          />
          <button
            type="submit"
            className="btn-primary !py-3 !px-5 !rounded-2xl shrink-0"
            disabled={sending || !input.trim()}
          >
            Invia
          </button>
        </form>
      </div>
    </div>
  )
}
