import { useEffect, useState } from 'react'
import { useAuthStore, useEditAccess } from '../store/authStore.js'
import { useKeepAwakeStore } from '../store/keepAwakeStore.js'
import { isWakeLockSupported } from '../components/common/KeepAwakeController.jsx'
import { apiFetch } from '../services/api.js'
import BackupSection from '../components/common/BackupSection.jsx'
import Icon from '../components/ui/Icon.jsx'

const CATEGORIES = [
  { key: 'all', label: 'Tutte', icon: 'tune' },
  { key: 'app', label: 'App', icon: 'apps', count: 2 },
  { key: 'device', label: 'Dispositivo', icon: 'devices', count: 2 },
  { key: 'backup', label: 'Backup', icon: 'cloud_download', count: 1 },
  { key: 'recipes-view', label: 'Ricette', icon: 'view_quilt', count: 1 }
]

/** One horizontal settings row: icon + title + text on the left, control on the right. */
function Row({ icon, tone, title, titleFor, children, control, wide = false }) {
  const Title = titleFor ? 'label' : 'h3'
  return (
    <div className="p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
      <div className={`flex items-start gap-4 ${wide ? 'max-w-xl' : 'max-w-md'}`}>
        <span className={`icon-badge mt-0.5 ${tone}`}>
          <Icon name={icon} />
        </span>
        <div className="flex flex-col gap-1 min-w-0">
          <Title htmlFor={titleFor} className="font-headline text-headline-md text-on-surface">
            {title}
          </Title>
          {children}
        </div>
      </div>
      {control}
    </div>
  )
}

function Section({ id, title, visible, children }) {
  if (!visible) return null
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-2 animate-fade-in">
      <h2 id={`${id}-heading`} className="eyebrow px-1">
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function Settings() {
  const familyAppName = useAuthStore((s) => s.familyAppName)
  const setFamilyAppName = useAuthStore((s) => s.setFamilyAppName)
  const featuredMode = useAuthStore((s) => s.featuredMode)
  const setFeaturedMode = useAuthStore((s) => s.setFeaturedMode)
  const recipesView = useAuthStore((s) => s.recipesView) || 'dettaglio'
  const setRecipesView = useAuthStore((s) => s.setRecipesView)
  const { canEdit, requestUnlock, lock } = useEditAccess()

  const [filter, setFilter] = useState('all')
  const [familyName, setFamilyName] = useState(familyAppName || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  const keepAwake = useKeepAwakeStore((s) => s.enabled)
  const setKeepAwake = useKeepAwakeStore((s) => s.setEnabled)
  const keepAwakeActive = useKeepAwakeStore((s) => s.active)
  const keepAwakeError = useKeepAwakeStore((s) => s.error)
  const wakeLockOk = isWakeLockSupported()

  useEffect(() => {
    setFamilyName(familyAppName || '')
  }, [familyAppName])

  const saveFamilyName = async (e) => {
    e.preventDefault()
    setMsg(null)
    setErr(null)
    if (!(await requestUnlock())) return
    setBusy(true)
    try {
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ familyAppName: familyName })
      })
      setFamilyAppName(res.data.familyAppName)
      setMsg('Nome salvato')
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  const show = (key) => filter === 'all' || filter === key
  const wakeStatus = !wakeLockOk
    ? 'Non supportato da questo browser (su iPhone serve iOS 16.4 o successivo)'
    : !keepAwake
      ? 'Disattivo'
      : keepAwakeActive
        ? 'Attivo mentre l’app è aperta'
        : keepAwakeError
          ? 'Non attivo: tocca lo schermo per riprovare'
          : 'In attivazione…'
  const wakeOn = keepAwake && wakeLockOk

  return (
    <main className="max-w-[1200px] w-full mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8 animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="page-title">Impostazioni</h1>
          <p className="font-body text-body-lg text-on-surface-variant">
            Gestisci accesso alle modifiche, comportamento dello schermo in cucina e backup dell’archivio.
          </p>
        </div>
        <span
          className={`shrink-0 self-start md:self-auto inline-flex items-center gap-1 px-4 py-1 rounded-full border font-body text-label-sm ${
            canEdit
              ? 'bg-secondary-container border-secondary/30 text-secondary-on-container'
              : 'bg-surface-container-low border-outline-variant text-on-surface-variant'
          }`}
        >
          <Icon name={canEdit ? 'edit' : 'visibility'} size={16} />
          {canEdit ? 'Modifiche sbloccate' : 'Modalità solo lettura attiva'}
        </span>
      </header>

      {msg && (
        <p className="font-body text-body-md text-secondary-on-container bg-secondary-container border border-secondary/20 rounded-xl px-4 py-2">
          {msg}
        </p>
      )}
      {err && (
        <p className="font-body text-body-md text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-2" role="alert">
          {err}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Category rail */}
        <aside aria-label="Categorie impostazioni" className="hidden lg:flex lg:col-span-3 lg:sticky lg:top-24 flex-col gap-4">
          <div className="card p-2 flex flex-col gap-1">
            {CATEGORIES.map((c) => {
              const active = filter === c.key
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(c.key)}
                  className={`w-full flex items-center justify-between gap-2 px-4 py-2 rounded-xl font-body text-label-lg text-left transition-colors duration-state-change ${
                    active
                      ? 'bg-primary-tint text-primary-on-tint'
                      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon name={c.icon} size={18} />
                    {c.label}
                  </span>
                  <span className="text-label-sm opacity-75">{c.count ?? 6}</span>
                </button>
              )
            })}
          </div>

          <div className="card p-4 flex flex-col gap-2">
            <span className="eyebrow">Stato rapido</span>
            <div className="flex items-center justify-between font-body text-body-md">
              <span className="text-on-surface-variant">Accesso</span>
              <span className="font-medium text-on-surface">{canEdit ? 'Sbloccato' : 'Solo lettura'}</span>
            </div>
            <div className="flex items-center justify-between font-body text-body-md">
              <span className="text-on-surface-variant">Schermo cucina</span>
              <span className="font-medium text-on-surface">{wakeOn ? 'Attivo' : 'Disattivo'}</span>
            </div>
            <div className="flex items-center justify-between font-body text-body-md">
              <span className="text-on-surface-variant">Ricette</span>
              <span className="font-medium text-on-surface">{recipesView === 'caselle' ? 'Caselle' : 'Dettaglio'}</span>
            </div>
          </div>
        </aside>

        <div className="lg:col-span-9 flex flex-col gap-6 lg:gap-8">
          {/* App e accesso */}
          <Section id="app" title="App e accesso" visible={show('app')}>
            <div className="card divide-y divide-outline-variant">
              <Row
                icon={canEdit ? 'lock_open' : 'lock'}
                tone="bg-primary-tint text-primary-on-tint"
                wide
                title={
                  <span className="flex items-center gap-2 flex-wrap">
                    Modifiche
                    <span
                      className={`chip ${canEdit ? '!bg-secondary-container !text-secondary-on-container !border-secondary/30' : ''}`}
                    >
                      {canEdit ? 'Sbloccato su questo dispositivo' : 'Solo lettura'}
                    </span>
                  </span>
                }
                control={
                  <div className="shrink-0 flex items-center">
                    {canEdit ? (
                      <button type="button" className="btn-secondary" onClick={lock}>
                        <Icon name="lock" size={18} />
                        Blocca modifiche
                      </button>
                    ) : (
                      <button type="button" className="btn-primary" onClick={requestUnlock}>
                        Inserisci PIN
                      </button>
                    )}
                  </div>
                }
              >
                <p className="font-body text-body-md text-on-surface-variant text-pretty">
                  Tutti possono consultare le ricette. Per aggiungere, modificare, importare o usare l’IA serve il PIN
                  di famiglia; questo dispositivo lo ricorda finché non lo blocchi.
                </p>
              </Row>

              <Row
                icon="badge"
                tone="bg-surface-container-low text-on-surface border border-outline-variant"
                title="Nome dell’app"
                titleFor="app-name-input"
                control={
                  <form onSubmit={saveFamilyName} className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto">
                    <input
                      id="app-name-input"
                      className="input-field sm:!w-52"
                      value={familyName}
                      maxLength={60}
                      onChange={(e) => setFamilyName(e.target.value)}
                      placeholder="Ricettario"
                      aria-describedby="app-name-hint"
                    />
                    <button
                      type="submit"
                      className="btn-secondary shrink-0"
                      disabled={busy || !familyName.trim() || familyName.trim() === familyAppName}
                    >
                      {busy ? 'Salvataggio…' : 'Salva nome'}
                    </button>
                  </form>
                }
              >
                <p id="app-name-hint" className="font-body text-body-md text-on-surface-variant">
                  Visibile a tutti in alto (richiede PIN).
                </p>
              </Row>
            </div>
          </Section>

          {/* Questo dispositivo */}
          <Section id="device" title="Questo dispositivo" visible={show('device')}>
            <div className="card divide-y divide-outline-variant">
              <Row
                icon="auto_awesome"
                tone="bg-secondary-container text-secondary-on-container"
                title="Home"
                titleFor="home-featured-select"
                control={
                  <div className="w-full md:w-64 shrink-0">
                    <select
                      id="home-featured-select"
                      className="input-field"
                      value={featuredMode || 'random'}
                      onChange={(e) => setFeaturedMode(e.target.value)}
                    >
                      <option value="random">Casuale a ogni visita</option>
                      <option value="latest">Ultima aggiornata</option>
                      <option value="oldest">Più vecchia</option>
                    </select>
                  </div>
                }
              >
                <p className="font-body text-body-md text-on-surface-variant">
                  Ricetta in evidenza (vale solo su questo dispositivo).
                </p>
              </Row>

              <Row
                icon="light_mode"
                tone="bg-amber-tint text-amber-on-tint"
                title="Schermo"
                control={
                  <label
                    className={`flex items-center justify-between gap-4 px-4 py-2 rounded-xl bg-surface-container-low border border-outline-variant w-full md:w-64 shrink-0 ${
                      wakeLockOk ? 'cursor-pointer' : 'opacity-70'
                    }`}
                  >
                    <span className="flex flex-col min-w-0">
                      <span className="font-body text-label-lg text-on-surface">Tieni acceso</span>
                      <span className="font-body text-label-sm text-on-surface-variant">{wakeStatus}</span>
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      className="sr-only"
                      checked={keepAwake}
                      disabled={!wakeLockOk}
                      onChange={(e) => setKeepAwake(e.target.checked)}
                      aria-label="Tieni lo schermo acceso"
                    />
                    <span
                      aria-hidden
                      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-outline-variant transition-colors duration-state-change ${
                        wakeOn ? 'bg-secondary' : 'bg-surface-container-high'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-surface-container-lowest shadow-sm transition-transform duration-state-change ${
                          wakeOn ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </span>
                  </label>
                }
              >
                <p className="font-body text-body-md text-on-surface-variant">
                  Evita che lo schermo si spenga mentre cucini.
                </p>
                {wakeLockOk && keepAwake && keepAwakeError && (
                  <p className="font-body text-label-sm text-amber-800" role="alert">
                    {keepAwakeError}
                  </p>
                )}
                {wakeLockOk && keepAwake && (
                  <p className="font-body text-label-sm text-outline">
                    Se metti l’app in background lo schermo può spegnersi; tornando qui si riattiva da solo.
                  </p>
                )}
              </Row>
            </div>
          </Section>

          {/* Backup */}
          <Section id="backup" title="Archivio e sicurezza" visible={show('backup')}>
            <BackupSection />
          </Section>

          {/* Visualizzazione ricette */}
          <Section id="recipes-view" title="Visualizzazione ricette" visible={show('recipes-view')}>
            <div className="card">
              <Row
                icon="view_quilt"
                tone="bg-secondary-container text-secondary-on-container"
                wide
                title="Visualizzazione ricette"
                control={
                  <div
                    role="radiogroup"
                    aria-label="Modalità di visualizzazione ricette"
                    className="inline-flex self-start md:self-auto items-center gap-1 bg-surface-container-low p-1 rounded-full border border-outline-variant shrink-0"
                  >
                    {[
                      ['dettaglio', 'article', 'Dettaglio'],
                      ['caselle', 'grid_view', 'Caselle']
                    ].map(([key, icon, label]) => (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={recipesView === key}
                        onClick={() => setRecipesView(key)}
                        className={`inline-flex items-center gap-1 px-4 min-h-[36px] rounded-full font-body text-label-lg transition-colors duration-state-change ${
                          recipesView === key
                            ? 'bg-primary text-white'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        <Icon name={icon} size={18} />
                        {label}
                      </button>
                    ))}
                  </div>
                }
              >
                <p className="font-body text-body-md text-on-surface-variant text-pretty">
                  Scegli come mostrare le ricette nel catalogo: elenco con anteprima in dettaglio oppure a caselle
                  compatte. Sul telefono si usano sempre le caselle.
                </p>
              </Row>
            </div>
          </Section>
        </div>
      </div>
    </main>
  )
}
