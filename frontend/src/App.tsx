import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './Pages/Login'
import Account from './Pages/Account'
import RequireAuth from './RequireAuth'
import { useAuth } from './context/authContext'

function AppRoutes() {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-neutral-500">
        Loading...
      </div>
    )
  }
  return (
    <Routes>
      <Route path="/" element={<Navigate to={session ? '/account' : '/login'} replace/>} />
      <Route path="/login" element={session ? <Navigate to="/account" replace/> : <Login />} />
      <Route element={<RequireAuth />}>
        <Route path="/account" element={<Account />} />
      </Route>
      <Route path="*" element={<Navigate to={session ? '/account' : '/login'} replace />}/>
    </Routes>
  )
}

export default function App() {
  return <AppRoutes />
}
