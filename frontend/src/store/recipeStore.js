import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MAX_CACHED_RECIPES = 40

function toIndexShape(recipe) {
  return {
    id: recipe.id,
    title: recipe.title,
    author: recipe.author,
    authorDisplayName: recipe.authorDisplayName || null,
    tags: recipe.metadata?.tags || recipe.tags || [],
    isShared: recipe.metadata?.isShared ?? recipe.isShared ?? true,
    isPrivate: recipe.metadata?.isPrivate ?? recipe.isPrivate ?? false,
    sharedWithUserIds:
      recipe.metadata?.sharedWithUserIds || recipe.sharedWithUserIds || [],
    sharedWith: recipe.sharedWith || [],
    servings: recipe.metadata?.servings ?? recipe.servings,
    difficulty: recipe.metadata?.difficulty ?? recipe.difficulty,
    imageUrl: recipe.imageUrl || null,
    caloriesPerServing: recipe.nutritionInfo?.perServing?.calories ?? recipe.caloriesPerServing ?? null,
    updatedAt: recipe.updatedAt
  }
}

function trimCache(cache, keepId) {
  const entries = Object.entries(cache || {})
  if (entries.length <= MAX_CACHED_RECIPES) return cache
  entries.sort((a, b) => {
    const ta = Date.parse(a[1]?.updatedAt || 0) || 0
    const tb = Date.parse(b[1]?.updatedAt || 0) || 0
    return tb - ta
  })
  const next = {}
  for (const [id, recipe] of entries.slice(0, MAX_CACHED_RECIPES)) {
    next[id] = recipe
  }
  if (keepId && cache[keepId]) next[keepId] = cache[keepId]
  return next
}

export const useRecipeStore = create(
  persist(
    (set, get) => ({
      recipes: [],
      recipeCache: {},
      selectedRecipe: null,
      searchFilter: '',
      isLoading: false,
      error: null,
      offlineFallback: false,

      setRecipes: (recipes) =>
        set({ recipes, error: null, offlineFallback: false }),

      setSelectedRecipe: (selectedRecipe) => set({ selectedRecipe }),

      setSearchFilter: (searchFilter) => set({ searchFilter }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error, isLoading: false }),

      setOfflineFallback: (offlineFallback) => set({ offlineFallback }),

      cacheRecipe: (recipe) => {
        if (!recipe?.id) return
        set((state) => ({
          recipeCache: trimCache(
            { ...state.recipeCache, [recipe.id]: recipe },
            recipe.id
          )
        }))
      },

      getCachedRecipe: (id) => get().recipeCache?.[id] || null,

      upsertRecipe: (recipe) =>
        set((state) => {
          const rest = state.recipes.filter((r) => r.id !== recipe.id)
          return {
            recipes: [toIndexShape(recipe), ...rest],
            selectedRecipe: recipe,
            recipeCache: trimCache(
              { ...state.recipeCache, [recipe.id]: recipe },
              recipe.id
            ),
            offlineFallback: false
          }
        }),

      removeRecipe: (id) =>
        set((state) => {
          const { [id]: _removed, ...restCache } = state.recipeCache || {}
          return {
            recipes: state.recipes.filter((r) => r.id !== id),
            selectedRecipe: state.selectedRecipe?.id === id ? null : state.selectedRecipe,
            recipeCache: restCache
          }
        })
    }),
    {
      name: 'recipe-book-recipes',
      partialize: (state) => ({
        recipes: state.recipes,
        recipeCache: state.recipeCache
      })
    }
  )
)
