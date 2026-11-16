import { Link, Outlet } from 'react-router-dom'
import { useEditAccess } from '../../store/authStore.js'

/** Route guard for add / edit / import pages: asks for the family PIN inline. */
export default function RequireEdit() {
  const { canEdit, requestUnlock } = useEditAccess()
  if (canEdit) return <Outlet />

  return (
    <main className="max-w-md mx-auto px-4 py-12 text-center animate-fade-in">
      <h1 className="font-display text-2xl font-semibold text-stone-900">Serve il PIN di famiglia</h1>
      <p className="mt-2 text-sm text-stone-500">
        Tutti possono consultare le ricette; per aggiungerle o modificarle serve il PIN.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link to="/recipes" className="btn-secondary !py-2.5 !px-4 text-sm">
          Torna alle ricette
        </Link>
        <button type="button" className="btn-primary !py-2.5 !px-4 text-sm" onClick={requestUnlock}>
          Inserisci PIN
        </button>
      </div>
    </main>
  )
}
