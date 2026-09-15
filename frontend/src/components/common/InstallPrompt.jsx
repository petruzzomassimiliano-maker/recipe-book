import { useEffect, useState } from 'react'

const DISMISS_KEY = 'recipe-book-install-dismissed'

/**
 * Soft install prompt when beforeinstallprompt fires (Chrome/Edge).
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const onPrompt = (e) => {
      e.preventDefault()
      setDeferred(e)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (!visible || !deferred) return null

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  const install = async () => {
    deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setVisible(false)
  }

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:bottom-6 z-40 sm:max-w-sm animate-slide-up">
      <div className="rounded-2xl border border-stone-200 bg-white shadow-lg p-4 flex gap-3 items-start">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-stone-900 text-sm">Installa Recipe Book</p>
          <p className="text-xs text-stone-500 mt-1 leading-relaxed">
            Aggiungila alla schermata Home per aprirla come app, anche offline.
          </p>
          <div className="flex gap-2 mt-3">
            <button type="button" className="btn-primary !py-2 !px-3 text-sm" onClick={install}>
              Installa
            </button>
            <button type="button" className="btn-secondary !py-2 !px-3 text-sm" onClick={dismiss}>
              Non ora
            </button>
          </div>
        </div>
        <button
          type="button"
          className="text-stone-400 hover:text-stone-700 p-1"
          onClick={dismiss}
          aria-label="Chiudi"
        >
          ×
        </button>
      </div>
    </div>
  )
}
