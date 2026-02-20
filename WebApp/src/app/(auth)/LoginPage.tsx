import { Card, Input, Button } from '@/shared/ui'

export function LoginPage() {
  return (
    <Card title="Sign in">
      <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Input label="Email" type="email" placeholder="you@example.com" />
        <Input label="Password" type="password" placeholder="••••••••" />
        <Button type="submit" fullWidth>Sign in</Button>
      </form>
      <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
        Demo: use Admin / Vendor from nav.
      </p>
    </Card>
  )
}
