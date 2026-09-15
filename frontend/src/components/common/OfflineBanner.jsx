import { useOnlineStatus } from '../../hooks/useOnlineStatus.js'

export default function OfflineBanner({ usingCache = false }) {
  const online = useOnlineStatus()

  if (online && !usingCache) return null

  return (
    <div
      role="status"
      className={`sticky top-[57px] z-10 border-b px-4 py-2 text-center text-sm font-medium ${
        online
          ? 'bg-amber-50 border-amber-100 text-amber-900'
          : 'bg-stone-800 border-stone-700 text-stone-100'
      }`}
    >
      {online
        ? 'Stai vedendo dati in cache (ultima sincronizzazione disponibile).'
        : 'Sei offline — puoi sfogliare le ricette già aperte. Le modifiche richiederanno la connessione.'}
    </div>
  )
}
