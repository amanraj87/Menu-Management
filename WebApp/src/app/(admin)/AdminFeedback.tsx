import { Card, Button, Loader, Badge } from '@/shared/ui'
import { useFeedbacksForAdmin, useConfirmFeedback } from '@/shared/graphql/hooks'
import { useToastStore } from '@/shared/stores/toastStore'
import type { Feedback } from '@/shared/types'

export function AdminFeedback() {
  const toast = useToastStore()
  const { feedbacks, isLoading } = useFeedbacksForAdmin()
  const { confirmFeedback, isPending: confirmPending } = useConfirmFeedback(
    () => toast.add('Feedback confirmed. Vendor can see it.', 'success'),
    (e) => toast.add(e.message, 'error')
  )

  const pending = feedbacks.filter((f) => f.status === 'pending')
  const confirmed = feedbacks.filter((f) => f.status === 'confirmed')

  if (isLoading) return <Loader />

  return (
    <Card className="content-card" title="Feedback and suggestions">
      <p className="content-subtitle">
        Review feedback from users. Confirm to send to the vendor.
      </p>
      {pending.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Pending <Badge variant="warning">{pending.length}</Badge>
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {pending.map((f) => (
              <FeedbackCard key={f._id} feedback={f} onConfirm={() => confirmFeedback(f._id)} confirmPending={confirmPending} />
            ))}
          </ul>
        </section>
      )}
      {confirmed.length > 0 && (
        <section>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Confirmed (sent to vendor)
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {confirmed.map((f) => (
              <FeedbackCard key={f._id} feedback={f} />
            ))}
          </ul>
        </section>
      )}
      {feedbacks.length === 0 && (
        <p className="content-subtitle" style={{ marginBottom: 0 }}>No feedback yet.</p>
      )}
    </Card>
  )
}

function FeedbackCard({
  feedback,
  onConfirm,
  confirmPending,
}: {
  feedback: Feedback
  onConfirm?: () => void
  confirmPending?: boolean
}) {
  const isPending = feedback.status === 'pending'
  return (
    <li className="content-feedback-item">
      <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
        {feedback.userName} · {new Date(feedback.createdAt).toLocaleString()}
        {feedback.confirmedAt && (
          <span> · Confirmed {new Date(feedback.confirmedAt).toLocaleString()}</span>
        )}
      </div>
      <p style={{ margin: '0 0 0.5rem', whiteSpace: 'pre-wrap' }}>{feedback.text}</p>
      {isPending && onConfirm && (
        <Button size="sm" onClick={onConfirm} disabled={confirmPending}>
          {confirmPending ? 'Confirming…' : 'Confirm (send to vendor)'}
        </Button>
      )}
    </li>
  )
}
