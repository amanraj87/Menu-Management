import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Input, Button } from '@/shared/ui'
import { useUIStore } from '@/shared/stores/uiStore'
import { useMe } from '@/shared/graphql/hooks'
import { useToastStore } from '@/shared/stores/toastStore'

export function LoginPage() {
  const [userIdInput, setUserIdInput] = useState('')
  const setUserSession = useUIStore((s) => s.setUserSession)
  const userSession = useUIStore((s) => s.userSession)
  const navigate = useNavigate()
  const toast = useToastStore()

  const { me, isLoading: meLoading, error: meError } = useMe(!userSession?.userId, userSession?.userId ?? undefined)

  useEffect(() => {
    if (userSession?.userId && me && !userSession.name) {
      setUserSession({
        userId: userSession.userId,
        role: me.role as 'person' | 'admin' | 'vendor',
        name: me.name,
      })
    }
  }, [userSession?.userId, userSession?.name, me, setUserSession])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const id = userIdInput.trim()
    if (!id) {
      toast.add('Enter your User ID (MongoDB _id).', 'warning')
      return
    }
    setUserSession({ userId: id })
    toast.add('Checking user…', 'info')
  }

  const handleContinue = () => {
    if (!me) return
    const role = me.role as 'person' | 'admin' | 'vendor'
    if (role === 'admin') navigate('/admin', { replace: true })
    else if (role === 'vendor') navigate('/vendor', { replace: true })
    else navigate('/person', { replace: true })
  }

  const showContinue = userSession?.userId && me && userSession.name

  return (
    <Card title="Sign in">
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
        Enter your <strong>User ID</strong> (the MongoDB <code>_id</code> from the users collection). Example: 6998b3ea11df1b0adca09a97
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Input
          label="User ID"
          value={userIdInput}
          onChange={(e) => setUserIdInput(e.target.value)}
          placeholder="e.g. 6998b3ea11df1b0adca09a97"
        />
        <Button type="submit" fullWidth disabled={meLoading}>
          {meLoading ? 'Checking…' : 'Sign in'}
        </Button>
      </form>
      {meError && (
        <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--color-danger)' }}>
          {meError.message}. Is the GraphQL server running and is the User ID correct?
        </p>
      )}
      {showContinue && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
          <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            Signed in as <strong>{me.name}</strong> ({me.role})
          </p>
          <Button onClick={handleContinue} fullWidth>Continue to app</Button>
        </div>
      )}
    </Card>
  )
}
