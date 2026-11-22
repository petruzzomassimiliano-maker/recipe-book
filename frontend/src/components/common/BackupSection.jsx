import { useRef, useState } from 'react'
import { useAuthStore, useEditAccess } from '../../store/authStore.js'
import { useFavoritesStore } from '../../store/favoritesStore.js'
import { useRecipeStore } from '../../store/recipeStore.js'
import { listRecipes } from '../../services/recipes.js'
import { createBackup, downloadBlob, readBackupFile, restoreBackup } from '../../utils/backup.js'

function formatDateTime(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Settings card: download a full backup file, restore from one. */
export default function BackupSection() {
  const familyAppName = useAuthStore((s) => s.familyAppName)
  const { requestUnlock } = useEditAccess()
  const [includePhotos, setIncludePhotos] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)
  const [pending, setPending] = useState(null) // { backup, existingIds, existing, fresh }
  const fileRef = useRef(null)

  const doBackup = async () => {
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const res = await createBackup({
        includePhotos,
        appName: familyAppName,
        favorites: useFavoritesStore.getState().ids,
        onProgress: setProgress
      })
      downloadBlob(res.blob, res.fileName)
      const mb = (res.blob.size / 1024 / 1024).toFixed(1).replace('.', ',')
      setMsg(
        `Backup scaricato: ${res.recipes} ricette${includePhotos ? `, ${res.photos} foto` : ''} (${mb} MB).` +
          (res.failedPhotos ? ` ${res.failedPhotos} foto non scaricate (siti esterni non raggiungibili).` : '') +
          ' Conservalo fuori dal telefono (es. Google Drive o email).'
      )
    } catch (e) {
      setErr(`Backup non riuscito: ${e.message}`)
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  const pickFile = async (file) => {
    if (!file) return
    setErr(null)
    setMsg(null)
    setPending(null)
    try {
      const backup = await readBackupFile(file)
      const current = (await listRecipes('')).data || []
      const existingIds = new Set(current.map((r) => r.id))
      const existing = backup.recipes.filter((r) => existingIds.has(r.id)).length
      setPending({ backup, existingIds, existing, fresh: backup.recipes.length - existing })
    } catch (e) {
      setErr(e.message)
    }
  }

  const doRestore = async (overwrite) => {
    if (!pending) return
    if (
      overwrite &&
      pending.existing &&
      !window.confirm(
        `Sovrascrivere ${pending.existing} ricette con la versione del backup? Le modifiche fatte dopo il backup su quelle ricette andranno perse.`
      )
    ) {
      return
    }
    if (!(await requestUnlock())) return
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const res = await restoreBackup(pending.backup, {
        overwrite,
        existingIds: pending.existingIds,
        onProgress: setProgress
      })
      if (pending.backup.favorites?.length) {
        const fav = useFavoritesStore.getState()
        fav.setAll([...fav.ids, ...pending.backup.favorites])
      }
      const fresh = await listRecipes('').catch(() => null)
      if (fresh?.data) useRecipeStore.getState().setRecipes(fresh.data)
      setMsg(
        `Ripristino completato: ${res.restored} ricette ripristinate, ${res.skipped} già presenti lasciate com’erano.` +
          (res.failed.length ? ` Non riuscite: ${res.failed.map((f) => f.title).join(', ')}.` : '')
      )
      setPending(null)
    } catch (e) {
      setErr(`Ripristino interrotto: ${e.message}`)
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <section className="card p-4 sm:p-6 space-y-3">
      <h2 className="section-title">Backup</h2>
      <p className="text-sm text-stone-500 leading-relaxed">
        Scarica tutte le ricette (con diario e, se vuoi, le foto) in un unico file. Se un giorno si perde
        qualcosa, da qui puoi ripristinarle.
      </p>

      <label className="flex items-center gap-2 text-sm text-stone-700 min-h-[40px]">
        <input type="checkbox" checked={includePhotos} onChange={(e) => setIncludePhotos(e.target.checked)} disabled={busy} />
        Includi le foto (file più grande)
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary !py-2.5 !px-4 text-sm" onClick={doBackup} disabled={busy}>
          Scarica backup
        </button>
        <button type="button" className="btn-secondary !py-2.5 !px-4 text-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
          Ripristina da file…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            pickFile(file)
          }}
        />
      </div>

      {busy && progress && (
        <p className="text-sm text-stone-500" aria-live="polite">
          {progress}
        </p>
      )}
      {msg && <p className="text-sm text-teal-700 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2">{msg}</p>}
      {err && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2" role="alert">
          {err}
        </p>
      )}

      {pending && !busy && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 sm:p-4 space-y-3">
          <p className="text-sm text-stone-700 leading-relaxed">
            Backup{pending.backup.appName ? ` di «${pending.backup.appName}»` : ''} del{' '}
            <strong>{formatDateTime(pending.backup.createdAt)}</strong>: {pending.backup.recipes.length} ricette, di cui{' '}
            <strong>{pending.fresh} non presenti</strong> ora e {pending.existing} già presenti.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary !py-2.5 !px-4 text-sm"
              onClick={() => doRestore(false)}
              disabled={!pending.fresh}
            >
              Ripristina solo le mancanti ({pending.fresh})
            </button>
            {pending.existing > 0 && (
              <button type="button" className="btn-secondary !py-2.5 !px-4 text-sm" onClick={() => doRestore(true)}>
                Ripristina tutte (sovrascrive {pending.existing})
              </button>
            )}
            <button type="button" className="inline-flex items-center min-h-[44px] px-2 text-sm text-stone-500" onClick={() => setPending(null)}>
              Annulla
            </button>
          </div>
          <p className="text-xs text-stone-500">Serve il PIN di famiglia. Le ricette create dopo il backup non vengono toccate.</p>
        </div>
      )}
    </section>
  )
}
