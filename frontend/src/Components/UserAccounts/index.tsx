import { supabase } from '../../lib/supabaseClient'
import type { Session } from '@supabase/supabase-js'
import { useState, useEffect } from 'react'

type Mode = 'signin' | 'signup'

export default function UserAccounts() {
    const [mode, setMode] = useState<Mode>('signin')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [session, setSession] = useState<Session | null>(null)

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
        const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
        return () => sub.subscription.unsubscribe()
    }, [])

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setMessage(null)
        if (mode === 'signin' && password !== confirm) {
            setMessage('Passwords do not match')
            return
        }
        setLoading(true)
        try {
            if (mode === 'signup') {
                const { error } = await supabase.auth.signUp({ email, password })
                if (error) throw error
                setMessage('Check your email to confirm account, or sign in if confirmation is disabled')
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) throw error
            }
        } catch (err: unknown) {
            setMessage(err instanceof Error ? err.message : 'An unknown error occurred')
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleAuth = async () => {
        setMessage(null)
        setLoading(true)
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `http://localhost:5173/` },
        })
        setLoading(false)
        if (error) setMessage(error.message)
    }

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        setMessage(null)
    }

    if (session) {
        return (
            <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-6 max-w-md w-full">
                <p className="text-sm text-neutral-600">Signed in as <span className="font-medium text-neutral-900">{session.user.email}</span></p>
                <button type="button" onClick={handleSignOut} className="rounded bg-neutral-900 px-4 py-2 text-white">
                    Sign out
                </button>
            </div>
        )
    }
    return (
        <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-6 max-w-md w-full">
            <div className="flex rounded-md bg-neutral-100 p-1">
                <button type="button" className={`flex-1 rounded py-1.5 text-sm ${mode === 'signin' ? 'bg-white shadow' : ''}`} onClick={() => setMode('signin')}>Sign in</button>
                <button type="button" className={`flex-1 rounded py-1.5 text-sm ${mode === 'signup' ? 'bg-white shadow' : ''}`} onClick={() => setMode('signup')}>Sign up</button>
            </div>
            <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-sm">
                    <span>Email</span>
                    <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded border px-3 py-2" />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                    <span>Password</span>
                    <input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required value={password} onChange={(e) => setPassword(e.target.value)} className="rounded border px-3 py-2" />
                </label>
                {mode === 'signup' && (
                    <label className="flex flex-col gap-1 text-sm">
                        <span>Confirm password</span>
                        <input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="rounded border px-3 py-2" />
                    </label>
                )}
                <button type="submit" disabled={loading} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
                    {loading ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
                </button>
            </form>
            <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-neutral-200" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-neutral-500">Or</span></div>
            </div>
            <button type="button" onClick={handleGoogleAuth} disabled={loading} className="rounded border border-neutral-300 px-4 py-2 text-sm disabled:opacity-50">
                Continue with Google
            </button>
            {message && <p className="text-sm text-neutral-600">{message}</p>}
        </div>
    )
}