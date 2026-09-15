import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { useAuthStore } from '../store/authStore.js'
import {
  getFamilySettings,
  getMe,
  inviteUser,
  listUsers,
  updateFamilySettings,
  updateMyPreferences,
  updateUser,
  deleteUser
} from '../services/users.js'

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', member: 'Member' }

export default function Settings() {
  const { isStaff, isOwner, user, familyAppName } = useAuth()
  const setAuthUser = useAuthStore((s) => s.setUser)
  const setFamilyAppName = useAuthStore((s) => s.setFamilyAppName)

  const [appLabel, setAppLabel] = useState(user?.preferences?.appLabel || '')
  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [featuredMode, setFeaturedMode] = useState(user?.preferences?.featuredMode || 'random')
  const [familyName, setFamilyName] = useState(familyAppName || '')
  const [users, setUsers] = useState([])
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)
  const [invite, setInvite] = useState({
    username: '',
    displayName: '',
    role: 'member'
  })
  const [lastInvite, setLastInvite] = useState(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const reload = async () => {
    const me = await getMe()
    setAuthUser(me.data.user)
    setFamilyAppName(me.data.familyAppName)
    setAppLabel(me.data.user.preferences?.appLabel || '')
    setDisplayName(me.data.user.displayName || '')
    setFeaturedMode(me.data.user.preferences?.featuredMode || 'random')
    setFamilyName(me.data.familyAppName || '')
    if (isStaff) {
      const res = await listUsers()
      setUsers(res.data || [])
      const settings = await getFamilySettings()
      setFamilyName(settings.data?.familyAppName || '')
    }
  }

  useEffect(() => {
    reload().catch((e) => setErr(e.message))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const savePrefs = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const res = await updateMyPreferences({ appLabel, displayName, featuredMode })
      setAuthUser(res.data)
      setMsg('Preferenze salvate')
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  const saveFamily = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const res = await updateFamilySettings({ familyAppName: familyName })
      setFamilyAppName(res.data.familyAppName)
      setMsg('Nome famiglia aggiornato')
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  const sendInvite = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    setLastInvite(null)
    setCopied(false)
    try {
      const res = await inviteUser(invite)
      setLastInvite(res.data)
      setInvite({ username: '', displayName: '', role: 'member' })
      await reload()
      setMsg('Invito creato — copia il testo qui sotto e invialo (WhatsApp, SMS, ecc.)')
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  const inviteShareText = (data) => {
    if (!data?.inviteUrl) return ''
    const name = data.user?.displayName || data.user?.username || ''
    const user = data.user?.username || ''
    const exp = data.inviteExpiresAt
      ? new Date(data.inviteExpiresAt).toLocaleDateString('it-IT')
      : '7 giorni'
    return [
      `Ciao${name ? ` ${name}` : ''}!`,
      `Sei invitato/a al ricettario di famiglia.`,
      ``,
      `1) Apri questo link:`,
      data.inviteUrl,
      ``,
      `2) Scegli la tua password (username: ${user})`,
      ``,
      `Il link vale una sola volta e scade il ${exp}.`
    ].join('\n')
  }

  const copyInvite = async () => {
    const text = inviteShareText(lastInvite)
    if (!text) return
    try {
      await navigator.clipboard?.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setErr('Copia non riuscita — seleziona il testo a mano')
    }
  }

  const setRole = async (id, role) => {
    setBusy(true)
    try {
      await updateUser(id, { role })
      await reload()
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  const setActive = async (id, active) => {
    setBusy(true)
    try {
      await updateUser(id, { active })
      await reload()
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  const removeUser = async (u) => {
    const label = u.displayName || u.username
    if (
      !window.confirm(
        `Eliminare definitivamente “${label}” (@${u.username})?\n\nL’account sparisce: non potrà più accedere. Le ricette che ha creato restano nel ricettario.`
      )
    ) {
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await deleteUser(u.id)
      await reload()
      setMsg(`Account @${u.username} eliminato`)
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  const brand = appLabel || familyAppName || 'Recipe Book'

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-fade-in space-y-8">
      <div>
        <h1 className="page-title">Impostazioni</h1>
        <p className="text-sm text-stone-500 mt-1">
          Nell’app vedi: <strong>{brand}</strong>
        </p>
      </div>

      {msg && <p className="text-sm text-teal-700 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2">{msg}</p>}
      {err && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2" role="alert">
          {err}
        </p>
      )}

      <section className="card p-5 sm:p-6 space-y-4">
        <h2 className="section-title">Il tuo profilo</h2>
        <form onSubmit={savePrefs} className="space-y-3">
          <label className="block text-sm">
            <span className="text-stone-600">Nome visualizzato</span>
            <input className="input-field mt-1" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="text-stone-600">Nome app personale (solo per te)</span>
            <input
              className="input-field mt-1"
              value={appLabel}
              onChange={(e) => setAppLabel(e.target.value)}
              placeholder={familyAppName || 'Recipe Book'}
            />
          </label>
          <label className="block text-sm">
            <span className="text-stone-600">Ricetta in evidenza (home)</span>
            <select
              className="input-field mt-1"
              value={featuredMode}
              onChange={(e) => setFeaturedMode(e.target.value)}
            >
              <option value="random">Casuale a ogni visita</option>
              <option value="latest">Ultima aggiornata</option>
              <option value="oldest">Più vecchia</option>
            </select>
          </label>
          <button type="submit" className="btn-primary !py-2.5 !px-4 text-sm" disabled={busy}>
            Salva preferenze
          </button>
        </form>
      </section>

      {isStaff && (
        <section className="card p-5 sm:p-6 space-y-4">
          <h2 className="section-title">Famiglia</h2>
          <form onSubmit={saveFamily} className="space-y-3">
            <label className="block text-sm">
              <span className="text-stone-600">Nome app famiglia (per tutti)</span>
              <input
                className="input-field mt-1"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
              />
            </label>
            <button type="submit" className="btn-secondary !py-2.5 !px-4 text-sm" disabled={busy}>
              Salva nome famiglia
            </button>
          </form>
        </section>
      )}

      {isStaff && (
        <section className="card p-5 sm:p-6 space-y-4">
          <h2 className="section-title">Invita utente</h2>
          <p className="text-sm text-stone-500 leading-relaxed">
            Crea l’account e <strong>copia il messaggio</strong> da mandare tu (WhatsApp, SMS,
            ecc.). L’invitato apre il link, sceglie la password ed entra. Il link vale{' '}
            <strong>una sola volta</strong> e scade dopo <strong>7 giorni</strong> (solo per
            attivarsi); dopo accede sempre con username e password.
          </p>
          <form onSubmit={sendInvite} className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-stone-600">Username</span>
              <input
                className="input-field mt-1"
                required
                value={invite.username}
                onChange={(e) => setInvite((i) => ({ ...i, username: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-stone-600">Nome</span>
              <input
                className="input-field mt-1"
                value={invite.displayName}
                onChange={(e) => setInvite((i) => ({ ...i, displayName: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-stone-600">Ruolo</span>
              <select
                className="input-field mt-1"
                value={invite.role}
                onChange={(e) => setInvite((i) => ({ ...i, role: e.target.value }))}
              >
                <option value="member">Member</option>
                {isOwner && <option value="admin">Admin</option>}
              </select>
            </label>
            <div className="flex items-end">
              <button type="submit" className="btn-primary !py-2.5 !px-4 text-sm w-full" disabled={busy}>
                Crea invito
              </button>
            </div>
          </form>

          {lastInvite && (
            <div className="rounded-xl border border-teal-200 bg-teal-50/80 p-4 text-sm text-teal-950 space-y-3">
              <p className="font-semibold">Da inviare al destinatario</p>
              <pre className="whitespace-pre-wrap break-all text-xs bg-white border border-teal-100 rounded-lg p-3 text-stone-800 font-sans leading-relaxed">
                {inviteShareText(lastInvite)}
              </pre>
              <button
                type="button"
                className="btn-primary !py-2.5 !px-4 text-sm"
                onClick={copyInvite}
              >
                {copied ? 'Copiato!' : 'Copia tutto'}
              </button>
            </div>
          )}
        </section>
      )}

      {isStaff && (
        <section className="card p-5 sm:p-6 space-y-3">
          <h2 className="section-title">Utenti</h2>
          <ul className="divide-y divide-stone-100">
            {users.map((u) => (
              <li key={u.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-stone-900">
                    {u.displayName}{' '}
                    <span className="text-xs text-stone-400 font-normal">@{u.username}</span>
                  </p>
                  <p className="text-xs text-stone-500">
                    {ROLE_LABEL[u.role] || u.role}
                    {!u.active ? ' · disattivato' : ''}
                  </p>
                </div>
                {u.role !== 'owner' && (
                  <div className="flex flex-wrap gap-2">
                    {isOwner && u.role === 'member' && (
                      <button
                        type="button"
                        className="text-xs btn-secondary !py-1.5 !px-2.5"
                        onClick={() => setRole(u.id, 'admin')}
                        disabled={busy}
                      >
                        Nomina admin
                      </button>
                    )}
                    {isOwner && u.role === 'admin' && (
                      <button
                        type="button"
                        className="text-xs btn-secondary !py-1.5 !px-2.5"
                        onClick={() => setRole(u.id, 'member')}
                        disabled={busy}
                      >
                        Rimuovi admin
                      </button>
                    )}
                    {u.active !== false ? (
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => setActive(u.id, false)}
                        disabled={busy}
                      >
                        Disattiva
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-teal-700 hover:underline"
                        onClick={() => setActive(u.id, true)}
                        disabled={busy}
                      >
                        Riattiva
                      </button>
                    )}
                    {(isOwner || u.role === 'member') && (
                      <button
                        type="button"
                        className="text-xs text-red-700 font-medium hover:underline"
                        onClick={() => removeUser(u)}
                        disabled={busy}
                      >
                        Elimina
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
