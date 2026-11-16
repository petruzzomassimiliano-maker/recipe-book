import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Recipes from './pages/Recipes.jsx'
import AddRecipe from './pages/AddRecipe.jsx'
import ImportRecipe from './pages/ImportRecipe.jsx'
import RecipeDetail from './pages/RecipeDetail.jsx'
import Settings from './pages/Settings.jsx'
import NotFound from './pages/NotFound.jsx'
import AppLayout from './components/common/AppLayout.jsx'
import RequireEdit from './components/common/RequireEdit.jsx'

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/recipes/:id" element={<RecipeDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route element={<RequireEdit />}>
            <Route path="/recipes/new" element={<AddRecipe />} />
            <Route path="/recipes/import" element={<ImportRecipe />} />
            <Route path="/recipes/:id/edit" element={<AddRecipe />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Old routes from the multi-user version */}
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/shopping-list" element={<Navigate to="/recipes" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
