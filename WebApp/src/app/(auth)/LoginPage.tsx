import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Input, Button } from '@/shared/ui'
import { useUIStore } from '@/shared/stores/uiStore'
import { useLogin, useSignUp } from '@/shared/graphql/hooks'
import { useToastStore } from '@/shared/stores/toastStore'

export function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [passwordHash, setpasswordHash] = useState('')
  const [name, setName] = useState('')
  const setUserSession = useUIStore((s) => s.setUserSession)
  const navigate = useNavigate()
  const toast = useToastStore()

  const handleAuthSuccess = (user: { _id: string; name: string; role: string }) => {
    setUserSession({ userId: user._id, role: user.role as 'person' | 'admin' | 'vendor', name: user.name })
    if (user.role === 'admin') navigate('/admin', { replace: true })
    else if (user.role === 'vendor') navigate('/vendor', { replace: true })
    else navigate('/person', { replace: true })
  }

  const { login, isPending: loginPending } = useLogin()
  const { signUp, isPending: signUpPending } = useSignUp(handleAuthSuccess, (e) =>
    toast.add(e.message, 'error')
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      toast.add('Enter your email.', 'warning')
      return
    }
    if (!passwordHash) {
      toast.add('Enter your passwordHash.', 'warning')
      return
    }
    if (isSignUp) {
      const trimmedName = name.trim()
      if (!trimmedName) {
        toast.add('Enter your name.', 'warning')
        return
      }
      signUp({ name: trimmedName, email: trimmedEmail, passwordHash })
    } else {
      login(trimmedEmail, passwordHash)
        .then(handleAuthSuccess)
        .catch((e: Error) => {
          const msg = e.message === 'User not found'
            ? 'No user found with this id, please sign up first'
            : e.message
          toast.add(msg, 'error')
        })
    }
  }

  const isPending = loginPending || signUpPending

  return (
    <Card className="login-card" title={isSignUp ? 'Sign up' : 'Sign in'}>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
        {isSignUp
          ? 'Create an account. You will be able to choose meals as a person.'
          : 'Sign in with your email and passwordHash.'}
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
        {isSignUp && (
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required={isSignUp}
          />
        )}
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        <Input
          label="Password"
          type="password"
          value={passwordHash}
          onChange={(e) => setpasswordHash(e.target.value)}
          placeholder={isSignUp ? 'Choose a password' : 'Your password'}
          required
        />
        <Button type="submit" fullWidth disabled={isPending}>
          {isPending ? (isSignUp ? 'Creating account…' : 'Signing in…') : isSignUp ? 'Sign up' : 'Sign in'}
        </Button>
      </form>
      <p>
        {isSignUp ? (
          <>
            Already have an account?{' '}
            <button type="button" className="link" onClick={() => setIsSignUp(false)}>
              Sign in
            </button>
          </>
        ) : (
          <>
            New user?{' '}
            <button type="button" className="link" onClick={() => setIsSignUp(true)}>
              Sign up
            </button>
          </>
        )}
      </p>
    </Card>
  )
}
