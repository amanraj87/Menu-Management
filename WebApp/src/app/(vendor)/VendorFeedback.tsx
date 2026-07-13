import { useState } from 'react'
import { Card, Loader, FeedbackBubbles } from '@/shared/ui'
import { useConfirmedFeedbacks, useReplyToFeedback } from '@/shared/graphql/hooks'
import { useToastStore } from '@/shared/stores/toastStore'
import type { Feedback } from '@/shared/types'

export function VendorFeedback() {
  const { feedbacks, isLoading } = useConfirmedFeedbacks()

  if (isLoading) return <Loader />

  return (
    <Card className="content-card" title="Feedback and suggestions">
      <p className="content-subtitle">
        Feedback confirmed by admin and shared with you. Reply to reach the admin and the person who sent it.
      </p>
      {feedbacks.length === 0 ? (
        <p className="content-subtitle" style={{ marginBottom: 0 }}>No confirmed feedback yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {feedbacks.map((f) => (
            <ConversationCard key={f._id} feedback={f} />
          ))}
        </div>
      )}
    </Card>
  )
}

function ConversationCard({ feedback: f }: { feedback: Feedback }) {
  const toast = useToastStore()
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const { replyToFeedback, isPending } = useReplyToFeedback(
    () => { toast.add('Reply sent to admin and the user.', 'success'); setEditing(false); setText('') },
    (e) => toast.add(e.message, 'error')
  )
  const composerOpen = editing || !f.vendorReply
  const send = () => { if (text.trim()) replyToFeedback(f._id, text.trim()) }

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 14, background: 'var(--color-bg)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <FeedbackBubbles feedback={f} viewer="vendor" hideReply={editing} />

      {f.vendorReply && !editing && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { setEditing(true); setText(f.vendorReply ?? '') }}
            style={{ border: 'none', background: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.72rem', padding: '0.1rem 0.25rem' }}
          >
            ✎ Edit reply
          </button>
        </div>
      )}

      {composerOpen && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', paddingTop: '0.15rem' }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            rows={1}
            placeholder="Write a reply…"
            style={{
              flex: 1, resize: 'none', padding: '0.55rem 0.9rem', borderRadius: 20,
              border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
              fontSize: '0.9rem', fontFamily: 'inherit', lineHeight: 1.4, maxHeight: 120,
            }}
          />
          {editing && (
            <button
              onClick={() => { setEditing(false); setText('') }}
              style={{ border: 'none', background: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: '0.4rem' }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={send}
            disabled={isPending || !text.trim()}
            title="Send reply"
            style={{
              width: 38, height: 38, flexShrink: 0, borderRadius: '50%', border: 'none',
              background: text.trim() ? 'var(--color-primary, #22c55e)' : 'var(--color-border)',
              color: text.trim() ? '#04140a' : 'var(--color-text-muted)',
              cursor: text.trim() ? 'pointer' : 'default',
              fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s',
            }}
          >
            {isPending ? '…' : '➤'}
          </button>
        </div>
      )}
    </div>
  )
}
