import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

export type AuthContextValue = {
    session: Session | null
    user: User | null
    isLoading: boolean
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        supabase.auth.getSession().then(({ data }) => {
            if (cancelled) return
            setSession(data.session ?? null)
            setIsLoading(false)
        })

        const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
            setSession(next)
            setIsLoading(false)
        })

        return () => {
            cancelled = true
            sub.subscription.unsubscribe()
        }
    }, [])

    const signOut = useCallback(async () => {
        await supabase.auth.signOut()
    }, [])

    const value = useMemo<AuthContextValue>(
        () => ({
            session,
            user: session?.user ?? null,
            isLoading,
            signOut,
        }),
        [session, isLoading, signOut],
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext)
    if (ctx === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return ctx
}