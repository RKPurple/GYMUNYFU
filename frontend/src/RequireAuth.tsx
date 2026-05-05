import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './context/authContext'

export default function RequireAuth() {
    const { session, isLoading } = useAuth()
    if (!session) return <Navigate to="/login" replace />
    return <Outlet />
}