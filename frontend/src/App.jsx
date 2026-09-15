import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Setup from './pages/Setup.jsx'
import SetupOwner from './pages/SetupOwner.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import DropboxCallback from './pages/DropboxCallback.jsx'
import Home from './pages/Home.jsx'
import Recipes from './pages/Recipes.jsx'
import AddRecipe from './pages/AddRecipe.jsx'
import ImportRecipe from './pages/ImportRecipe.jsx'
import RecipeDetail from './pages/RecipeDetail.jsx'
import ShoppingList from './pages/ShoppingList.jsx'
import Settings from './pages/Settings.jsx'
import InviteAccept from './pages/InviteAccept.jsx'
import NotFound from './pages/NotFound.jsx'
import AuthGuard from './components/auth/AuthGuard.jsx'

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/setup/owner" element={<SetupOwner />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/invite/:token" element={<InviteAccept />} />
        <Route path="/dropbox-callback" element={<DropboxCallback />} />

        <Route element={<AuthGuard />}>
          <Route path="/" element={<Home />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/recipes/new" element={<AddRecipe />} />
          <Route path="/recipes/import" element={<ImportRecipe />} />
          <Route path="/recipes/:id" element={<RecipeDetail />} />
          <Route path="/recipes/:id/edit" element={<AddRecipe />} />
          <Route path="/shopping-list" element={<ShoppingList />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
