import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RecipeForm from '../components/recipe/RecipeForm.jsx'
import { useRecipes } from '../hooks/useRecipes.js'
import { clearDraft, draftKey } from '../hooks/useSessionDraft.js'

export default function AddRecipe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addRecipe, editRecipe, loadRecipe, selectedRecipe } = useRecipes()
  const [ready, setReady] = useState(!id)
  const [loadError, setLoadError] = useState(null)

  const persistKey = id ? draftKey(`recipe-form:edit:${id}`) : draftKey('recipe-form:new')
  const pageTitle = id ? 'Modifica ricetta' : 'Nuova ricetta'

  useEffect(() => {
    if (!id) {
      setReady(true)
      setLoadError(null)
      return
    }
    setReady(false)
    setLoadError(null)
    loadRecipe(id)
      .then(() => setReady(true))
      .catch((err) => setLoadError(err.message))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (payload) => {
    const saved = id ? await editRecipe(id, payload) : await addRecipe(payload)
    clearDraft(persistKey)
    navigate(`/recipes/${saved.id}`)
  }

  if (loadError) {
    return (
      <main className="max-w-3xl lg:max-w-6xl mx-auto px-4 py-8">
        <p className="text-red-600">{loadError}</p>
      </main>
    )
  }

  if (id && !ready) {
    return (
      <main className="max-w-3xl lg:max-w-6xl mx-auto px-4 py-8">
        <p className="text-stone-400">Caricamento ricetta…</p>
      </main>
    )
  }

  return (
    <main className="max-w-3xl lg:max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 animate-fade-in">
      {/* Mobile title only — desktop title lives in sticky form bar */}
      <h1 className="page-title mb-5 sm:mb-6 lg:hidden">{pageTitle}</h1>
      <RecipeForm
        key={id || 'new'}
        persistKey={persistKey}
        pageTitle={pageTitle}
        initialRecipe={id ? selectedRecipe : null}
        onSubmit={handleSubmit}
        onCancel={() => navigate(id ? `/recipes/${id}` : '/recipes')}
      />
    </main>
  )
}
