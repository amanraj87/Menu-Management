import { Card, Loader } from '@/shared/ui'
import { useConfirmedFeedbacks } from '@/shared/graphql/hooks'

export function VendorFeedback() {
  const { feedbacks, isLoading } = useConfirmedFeedbacks()

  if (isLoading) return <Loader />

  return (
    <Card className="content-card" title="Feedback and suggestions">
      <p className="content-subtitle">
        Feedback confirmed by admin and shared with you.
      </p>
      {feedbacks.length === 0 ? (
        <p className="content-subtitle" style={{ marginBottom: 0 }}>No confirmed feedback yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {feedbacks.map((f) => (
            <li key={f._id} className="content-feedback-item">
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                {f.userName} · {new Date(f.createdAt).toLocaleString()}
                {f.confirmedAt && ` · Confirmed ${new Date(f.confirmedAt).toLocaleString()}`}
              </div>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{f.text}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
