import { useCallback, useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { useAuth } from '../../context/authContext'

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

export function PlaidLinkButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [pendingOpen, setPendingOpen] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [exchangeStatus, setExchangeStatus] = useState<string | null>(null)
  const [isCreatingToken, setIsCreatingToken] = useState(false)
  const { session, isLoading } = useAuth()

  const authHeaders = useCallback((): HeadersInit => {
    const token = session?.access_token
    if (!token) return {}
    return { Authorization: `Bearer ${token}` }
  }, [session?.access_token])

  const onSuccess = useCallback(async (public_token: string) => {
    setExchangeStatus(null)

    const body = new URLSearchParams()
    body.set('public_token', public_token)

    const res = await fetch(`${API_BASE}/api/get_access_token`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        ...authHeaders(),
      },
      body,
    })

    if (!res.ok) {
      const text = await res.text()
      setExchangeStatus(text || `Exchange failed: ${res.status}`)
      return
    }

    setExchangeStatus('Connected - token exchanged on server.')
  }, [authHeaders])

  const onExit = useCallback(async (err: unknown, metadata: unknown) => {
    try {
      await fetch(`${API_BASE}/api/link_exit_error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ err, metadata }),
      })
    } catch {
      // logging only
    }
  }, [])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit,
  })

  // Open only after react-plaid-link has applied the new token and is ready.
  // setTimeout(..., 0) is unreliable; open() must see a valid token.
  useEffect(() => {
    if (!pendingOpen || !linkToken || !ready) return
    open()
    setPendingOpen(false)
  }, [pendingOpen, linkToken, ready, open])

  const createLinkToken = useCallback(async () => {
    if (!session?.access_token) throw new Error('Not signed in')
    const res = await fetch(`${API_BASE}/api/create_link_token`, { 
      method: 'POST',
      headers: {
        ...authHeaders(),
      },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `create_link_token failed: ${res.status}`)
    }

    const data = (await res.json()) as { link_token?: string }
    if (!data.link_token) throw new Error('No link_token in response')
    return data.link_token
  }, [authHeaders])

  const handleConnectClick = useCallback(async () => {
    setFetchError(null)

    try {
      if (!linkToken) {
        setIsCreatingToken(true)
        const token = await createLinkToken()
        setLinkToken(token)
        setPendingOpen(true)
        return
      }

      open()
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to create Link token')
    } finally {
      setIsCreatingToken(false)
    }
  }, [linkToken, createLinkToken, open])

  return (
    <div className="flex flex-col gap-2">
      {fetchError && <p className="text-red-600">Link setup error: {fetchError}</p>}

      <button
        type="button"
        onClick={handleConnectClick}
        disabled={isCreatingToken || (!!linkToken && !ready)}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {isCreatingToken ? 'Preparing Link...' : 'Connect bank'}
      </button>

      {exchangeStatus && <p className="text-sm">{exchangeStatus}</p>}
    </div>
  )
}

export default PlaidLinkButton