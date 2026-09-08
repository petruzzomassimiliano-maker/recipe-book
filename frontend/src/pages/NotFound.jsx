import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-surface dark:bg-surface-dark px-4">
      <div className="text-center animate-fade-in">
        <div className="text-8xl mb-6">🍳</div>
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
        <p className="text-xl text-gray-500 mb-8">Pagina non trovata</p>
        <Link to="/" className="btn-primary">
          Torna alla Home
        </Link>
      </div>
    </div>
  )
}
