import type { Feedback } from '@/shared/types'

type Viewer = 'user' | 'vendor' | 'admin'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function Bubble({ side, header, avatar, text }: { side: 'left' | 'right'; header: string; avatar?: string; text: string }) {
  if (side === 'left') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.6rem' }}>
        {avatar != null && (
          <div
            style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              background: 'var(--color-secondary, #3f3f46)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700,
            }}
            aria-hidden
          >
            {avatar}
          </div>
        )}
        <div style={{ maxWidth: '80%' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0 0.2rem 0.25rem' }}>{header}</div>
          <div
            style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              padding: '0.55rem 0.8rem', borderRadius: '4px 16px 16px 16px',
              fontSize: '0.9rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}
          >
            {text}
          </div>
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0.25rem 0.2rem 0' }}>{header}</div>
      <div
        style={{
          maxWidth: '80%', background: 'var(--color-primary, #22c55e)', color: '#04140a',
          padding: '0.55rem 0.8rem', borderRadius: '16px 4px 16px 16px',
          fontSize: '0.9rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontWeight: 500,
        }}
      >
        {text}
      </div>
    </div>
  )
}

/** Renders a feedback + optional vendor reply as a chat thread from `viewer`'s perspective. */
export function FeedbackBubbles({ feedback: f, viewer, hideReply }: { feedback: Feedback; viewer: Viewer; hideReply?: boolean }) {
  const userSide: 'left' | 'right' = viewer === 'user' ? 'right' : 'left'
  const vendorSide: 'left' | 'right' = viewer === 'user' ? 'left' : 'right'
  const userHeader = `${viewer === 'user' ? 'You' : f.userName} · ${timeLabel(f.createdAt)}`
  const vendorHeader = `${viewer === 'vendor' ? 'You (vendor)' : 'Vendor'}${f.vendorReplyAt ? ` · ${timeLabel(f.vendorReplyAt)}` : ''}`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <Bubble side={userSide} header={userHeader} avatar={userSide === 'left' ? initials(f.userName) : undefined} text={f.text} />
      {f.vendorReply && !hideReply && (
        <Bubble side={vendorSide} header={vendorHeader} avatar={vendorSide === 'left' ? '👨‍🍳' : undefined} text={f.vendorReply} />
      )}
    </div>
  )
}
