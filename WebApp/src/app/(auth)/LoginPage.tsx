import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Input, Button } from '@/shared/ui'
import { useUIStore } from '@/shared/stores/uiStore'
import { useLogin, useSignUp } from '@/shared/graphql/hooks'
import { useToastStore } from '@/shared/stores/toastStore'

const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
const EyeOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

export function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [passwordHash, setpasswordHash] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
        <div className="input-wrap">
          <label htmlFor="password" className="input-label">Password</label>
          <div
            className="input"
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              padding: 0,
            }}
          >
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={passwordHash}
              onChange={(e) => setpasswordHash(e.target.value)}
              placeholder={isSignUp ? 'Choose a password' : 'Your password'}
              required
              style={{
                flex: 1,
                minWidth: 0,
                padding: '0.65rem 0.9rem',
                paddingRight: 44,
                border: 'none',
                background: 'none',
                outline: 'none',
                fontSize: '1rem',
                color: 'var(--color-text)',
              }}
              onFocus={(e) => e.currentTarget.parentElement?.classList.add('input-focused')}
              onBlur={(e) => e.currentTarget.parentElement?.classList.remove('input-focused')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                padding: 4,
                border: 'none',
                background: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
              }}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>
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
