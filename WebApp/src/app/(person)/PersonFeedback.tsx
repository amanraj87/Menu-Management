import { useState } from 'react'
import { Card, Button, FeedbackBubbles } from '@/shared/ui'
import { useCreateFeedback, useMyFeedbacks } from '@/shared/graphql/hooks'
import { useToastStore } from '@/shared/stores/toastStore'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting admin review',
  confirmed: 'Shared with vendor',
  rejected: 'Not taken up',
}

export function PersonFeedback() {
  const [text, setText] = useState('')
  const toast = useToastStore()
  const { feedbacks } = useMyFeedbacks()
  const { createFeedback, isPending } = useCreateFeedback(
    () => {
      setText('')
      toast.add('Feedback submitted. Admin will review and may share with vendor.', 'success')
    },
    (e) => toast.add(e.message, 'error')
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) {
      toast.add('Please enter your feedback or suggestion.', 'error')
      return
    }
    createFeedback(trimmed)
  }

  return (
    <Card className="content-card" title="Feedback and suggestion">
      <p className="content-subtitle">
        Share feedback or suggestions about the menu or service. Admin will review; once confirmed, it goes to the vendor.
      </p>
      <form onSubmit={handleSubmit}>
        <label className="content-label">Your feedback</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="input"
          rows={4}
          placeholder="Type your feedback or suggestion here…"
          style={{ width: '100%', maxWidth: 480, marginBottom: '1rem' }}
        />
        <Button type="submit" disabled={isPending || !text.trim()}>
          {isPending ? 'Submitting…' : 'Submit'}
        </Button>
      </form>

      {feedbacks.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Your feedback</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {feedbacks.map((f) => (
              <div key={f._id} style={{ border: '1px solid var(--color-border)', borderRadius: 14, background: 'var(--color-bg)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <FeedbackBubbles feedback={f} viewer="user" />
                {!f.vendorReply && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>
                    {STATUS_LABEL[f.status] ?? f.status}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
