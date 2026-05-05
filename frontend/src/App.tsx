import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './Pages/Login'
import Connect from './Pages/Connect'
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
      <Route path="/" element={<Navigate to={session ? '/connect' : '/login'} replace/>} />
      <Route path="/login" element={session ? <Navigate to="/connect" replace/> : <Login />} />
      <Route element={<RequireAuth />}>
        <Route path="/connect" element={<Connect />} />
      </Route>
      <Route path="*" element={<Navigate to={session ? '/connect' : '/login'} replace />}/>
    </Routes>
  )
}

export default function App() {
  return <AppRoutes />
}
