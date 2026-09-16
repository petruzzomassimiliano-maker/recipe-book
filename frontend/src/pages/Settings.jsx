import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { useAuthStore } from '../store/authStore.js'
import { changePassword as changePasswordApi } from '../services/auth.js'
import {
  getFamilySettings,
  getMe,
  inviteUser,
  listUsers,
  updateFamilySettings,
  updateMyPreferences,
  updateUser,
  deleteUser,
  resetUserPassword,
  setMyRecoveryPhrase
} from '../services/users.js'

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', member: 'Member' }

export default function Settings() {
  const { isStaff, isOwner, user, familyAppName, jwt } = useAuth()
  const setAuthUser = useAuthStore((s) => s.setUser)
  const setFamilyAppName = useAuthStore((s) => s.setFamilyAppName)
  const setAuth = useAuthStore((s) => s.setAuth)
  const setMustChangePassword = useAuthStore((s) => s.setMustChangePassword)

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
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwBusy, setPwBusy] = useState(false)
  const [recovery, setRecovery] = useState({ phrase: '', current: '', confirm: '' })
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const [resetResult, setResetResult] = useState(null)

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

  const savePassword = async (e) => {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    if (pw.next.length < 8) {
      setErr('La nuova password deve avere almeno 8 caratteri')
      return
    }
    if (pw.next !== pw.confirm) {
      setErr('Le password non coincidono')
      return
    }
    setPwBusy(true)
    try {
      const data = await changePasswordApi(pw.current, pw.next, jwt)
      setAuth({
        jwt: data.jwt,
        user: data.user,
        familyAppName,
        mustChangePassword: false
      })
      setMustChangePassword(false)
      setPw({ current: '', next: '', confirm: '' })
      setMsg('Password aggiornata')
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setPwBusy(false)
    }
  }

  const saveRecovery = async (e) => {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    if (recovery.phrase.trim().length < 12) {
      setErr('Frase di recupero: minimo 12 caratteri')
      return
    }
    if (recovery.phrase !== recovery.confirm) {
      setErr('Le frasi di recupero non coincidono')
      return
    }
    setRecoveryBusy(true)
    try {
      const res = await setMyRecoveryPhrase({
        recoveryPhrase: recovery.phrase.trim(),
        currentPassword: recovery.current
      })
      setAuthUser(res.data)
      setRecovery({ phrase: '', current: '', confirm: '' })
      setMsg(
        'Frase di recupero salvata. Conservala offline: serve al login se dimentichi la password.'
      )
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setRecoveryBusy(false)
    }
  }

  const resetPasswordFor = async (u) => {
    const label = u.displayName || u.username
    if (
      !window.confirm(
        `Reimpostare la password di “${label}” (@${u.username})?\n\nVerrà creata una password temporanea da comunicargli.`
      )
    ) {
      return
    }
    setBusy(true)
    setErr(null)
    setResetResult(null)
    try {
      const res = await resetUserPassword(u.id)
      setResetResult(res.data)
      await reload()
      setMsg(`Password temporanea creata per @${u.username}`)
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  const brand = appLabel || familyAppName || 'Recipe Book'

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-8 animate-fade-in space-y-5 sm:space-y-8">
      <div>
        <h1 className="page-title">Impostazioni</h1>
        <p className="text-sm text-stone-500 mt-1">
          Nell’app vedi: <strong>{brand}</strong>
        </p>
      </div>

      {/* Sticky section jump — long settings pages need wayfinding on mobile */}
      <nav
        className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 px-4 py-2 bg-surface/95 backdrop-blur-md border-b border-stone-200/60 sm:static sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0"
        aria-label="Sezioni impostazioni"
      >
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {[
            { href: '#profilo', label: 'Profilo' },
            { href: '#password', label: 'Password' },
            { href: '#recupero', label: 'Recupero' },
            ...(isStaff
              ? [
                  { href: '#famiglia', label: 'Famiglia' },
                  { href: '#invito', label: 'Invita' },
                  { href: '#utenti', label: 'Utenti' }
                ]
              : [])
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="shrink-0 inline-flex items-center min-h-[40px] px-3.5 rounded-full bg-white border border-stone-200 text-sm font-medium text-stone-600 active:bg-stone-50"
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      {msg && <p className="text-sm text-teal-700 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2">{msg}</p>}
      {err && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2" role="alert">
          {err}
        </p>
      )}

      <section id="profilo" className="card p-4 sm:p-6 space-y-4 scroll-mt-28 sm:scroll-mt-24">
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
          <button type="submit" className="btn-primary !py-2.5 !px-4 text-sm w-full sm:w-auto" disabled={busy}>
            Salva preferenze
          </button>
        </form>
      </section>

      <section id="password" className="card p-4 sm:p-6 space-y-4 scroll-mt-28 sm:scroll-mt-24">
        <h2 className="section-title">Cambia password</h2>
        <p className="text-sm text-stone-500">Aggiorna la password del tuo account (@{user?.username}).</p>
        <form onSubmit={savePassword} className="space-y-3 max-w-md">
          <label className="block text-sm">
            <span className="text-stone-600">Password attuale</span>
            <input
              className="input-field mt-1"
              type="password"
              autoComplete="current-password"
              value={pw.current}
              onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-stone-600">Nuova password</span>
            <input
              className="input-field mt-1"
              type="password"
              autoComplete="new-password"
              value={pw.next}
              onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
              minLength={8}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-stone-600">Conferma nuova password</span>
            <input
              className="input-field mt-1"
              type="password"
              autoComplete="new-password"
              value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
              minLength={8}
              required
            />
          </label>
          <button type="submit" className="btn-primary !py-2.5 !px-4 text-sm w-full sm:w-auto" disabled={pwBusy}>
            {pwBusy ? 'Salvataggio…' : 'Aggiorna password'}
          </button>
        </form>
      </section>

      <section id="recupero" className="card p-4 sm:p-6 space-y-4 scroll-mt-28 sm:scroll-mt-24">
        <h2 className="section-title">Frase di recupero</h2>
        <p className="text-sm text-stone-500 leading-relaxed">
          Serve se dimentichi la password (anche da owner). Scrivila su carta o in un posto sicuro —
          non c’è recupero via email.{' '}
          {user?.hasRecovery ? (
            <span className="text-teal-800 font-medium">Già impostata: puoi aggiornarla qui.</span>
          ) : (
            <span className="text-amber-800 font-medium">Non ancora impostata.</span>
          )}
        </p>
        <form onSubmit={saveRecovery} className="space-y-3 max-w-md">
          <label className="block text-sm">
            <span className="text-stone-600">Password attuale</span>
            <input
              className="input-field mt-1"
              type="password"
              autoComplete="current-password"
              value={recovery.current}
              onChange={(e) => setRecovery((r) => ({ ...r, current: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-stone-600">Nuova frase di recupero (min. 12 caratteri)</span>
            <input
              className="input-field mt-1"
              type="password"
              autoComplete="off"
              value={recovery.phrase}
              onChange={(e) => setRecovery((r) => ({ ...r, phrase: e.target.value }))}
              minLength={12}
              required
              placeholder="es. gatto blu montagna 2019"
            />
          </label>
          <label className="block text-sm">
            <span className="text-stone-600">Conferma frase</span>
            <input
              className="input-field mt-1"
              type="password"
              autoComplete="off"
              value={recovery.confirm}
              onChange={(e) => setRecovery((r) => ({ ...r, confirm: e.target.value }))}
              minLength={12}
              required
            />
          </label>
          <button type="submit" className="btn-secondary !py-2.5 !px-4 text-sm w-full sm:w-auto" disabled={recoveryBusy}>
            {recoveryBusy ? 'Salvataggio…' : 'Salva frase di recupero'}
          </button>
        </form>
      </section>

      {isStaff && (
        <section id="famiglia" className="card p-4 sm:p-6 space-y-4 scroll-mt-28 sm:scroll-mt-24">
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
            <button type="submit" className="btn-secondary !py-2.5 !px-4 text-sm w-full sm:w-auto" disabled={busy}>
              Salva nome famiglia
            </button>
          </form>
        </section>
      )}

      {isStaff && (
        <section id="invito" className="card p-4 sm:p-6 space-y-4 scroll-mt-28 sm:scroll-mt-24">
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
        <section id="utenti" className="card p-4 sm:p-6 space-y-3 scroll-mt-28 sm:scroll-mt-24">
          <h2 className="section-title">Utenti</h2>
          {resetResult?.temporaryPassword && (
            <div className="rounded-xl border border-teal-200 bg-teal-50/80 p-4 text-sm text-teal-950 space-y-2">
              <p className="font-semibold">
                Password temporanea per @{resetResult.user?.username}
              </p>
              <p className="font-mono text-base bg-white border border-teal-100 rounded-lg px-3 py-2 break-all">
                {resetResult.temporaryPassword}
              </p>
              <p className="text-xs text-teal-800">
                Comunicala all’utente (WhatsApp/SMS). Al login dovrà scegliere una password nuova.
              </p>
              <button
                type="button"
                className="text-teal-800 font-medium underline text-xs"
                onClick={() =>
                  navigator.clipboard?.writeText(resetResult.temporaryPassword || '')
                }
              >
                Copia password
              </button>
            </div>
          )}
          <ul className="divide-y divide-stone-100">
            {users.map((u) => (
              <li key={u.id} className="py-3.5 space-y-2.5">
                <div>
                  <p className="font-medium text-stone-900">
                    {u.displayName}{' '}
                    <span className="text-xs text-stone-400 font-normal">@{u.username}</span>
                  </p>
                  <p className="text-xs text-stone-500">
                    {ROLE_LABEL[u.role] || u.role}
                    {!u.active ? ' · disattivato' : ''}
                    {u.mustChangePassword ? ' · deve cambiare password' : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {u.role !== 'owner' && u.id !== user?.id && (
                    <button
                      type="button"
                      className="text-xs btn-secondary !min-h-[40px] !py-2 !px-3"
                      onClick={() => resetPasswordFor(u)}
                      disabled={busy}
                    >
                      Reimposta password
                    </button>
                  )}
                  {u.role !== 'owner' && (
                    <>
                      {isOwner && u.role === 'member' && (
                        <button
                          type="button"
                          className="text-xs btn-secondary !min-h-[40px] !py-2 !px-3"
                          onClick={() => setRole(u.id, 'admin')}
                          disabled={busy}
                        >
                          Nomina admin
                        </button>
                      )}
                      {isOwner && u.role === 'admin' && (
                        <button
                          type="button"
                          className="text-xs btn-secondary !min-h-[40px] !py-2 !px-3"
                          onClick={() => setRole(u.id, 'member')}
                          disabled={busy}
                        >
                          Rimuovi admin
                        </button>
                      )}
                      {u.active !== false ? (
                        <button
                          type="button"
                          className="inline-flex items-center min-h-[40px] px-2 text-xs text-red-600"
                          onClick={() => setActive(u.id, false)}
                          disabled={busy}
                        >
                          Disattiva
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex items-center min-h-[40px] px-2 text-xs text-teal-700"
                          onClick={() => setActive(u.id, true)}
                          disabled={busy}
                        >
                          Riattiva
                        </button>
                      )}
                      {(isOwner || u.role === 'member') && (
                        <button
                          type="button"
                          className="inline-flex items-center min-h-[40px] px-2 text-xs text-red-700 font-medium"
                          onClick={() => removeUser(u)}
                          disabled={busy}
                        >
                          Elimina
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
