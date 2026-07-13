import { Card, Button, Loader, Badge, FeedbackBubbles } from '@/shared/ui'
import { useFeedbacksForAdmin, useConfirmFeedback, useRejectFeedback, useDeleteFeedback } from '@/shared/graphql/hooks'
import { useToastStore } from '@/shared/stores/toastStore'
import type { Feedback } from '@/shared/types'

export function AdminFeedback() {
  const toast = useToastStore()
  const { feedbacks, isLoading } = useFeedbacksForAdmin()
  const { confirmFeedback, isPending: confirmPending } = useConfirmFeedback(
    () => toast.add('Feedback confirmed. Vendor can see it.', 'success'),
    (e) => toast.add(e.message, 'error')
  )
  const { rejectFeedback, isPending: rejectPending } = useRejectFeedback(
    () => toast.add('Feedback rejected.', 'success'),
    (e) => toast.add(e.message, 'error')
  )
  const { deleteFeedback, isPending: deletePending } = useDeleteFeedback(
    () => toast.add('Feedback deleted.', 'success'),
    (e) => toast.add(e.message, 'error')
  )
  const handleDelete = (f: Feedback) => {
    deleteFeedback(f._id)
  }

  const pending = feedbacks.filter((f) => f.status === 'pending')
  const confirmed = feedbacks.filter((f) => f.status === 'confirmed')
  const rejected = feedbacks.filter((f) => f.status === 'rejected')

  if (isLoading) return <Loader />

  const renderList = (items: Feedback[], withActions?: boolean) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {items.map((f) => (
        <ConversationCard
          key={f._id}
          feedback={f}
          onConfirm={withActions ? () => confirmFeedback(f._id) : undefined}
          onReject={withActions ? () => rejectFeedback(f._id) : undefined}
          onDelete={() => handleDelete(f)}
          actionsPending={confirmPending || rejectPending || deletePending}
        />
      ))}
    </div>
  )

  return (
    <Card className="content-card" title="Feedback and suggestions">
      <p className="content-subtitle">
        Review feedback from users. Confirm to send to the vendor; vendor replies show up here too.
      </p>
      {pending.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Pending <Badge variant="warning">{pending.length}</Badge>
          </h3>
          {renderList(pending, true)}
        </section>
      )}
      {confirmed.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Confirmed (sent to vendor)</h3>
          {renderList(confirmed)}
        </section>
      )}
      {rejected.length > 0 && (
        <section>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Rejected <Badge variant="danger">{rejected.length}</Badge>
          </h3>
          {renderList(rejected)}
        </section>
      )}
      {feedbacks.length === 0 && (
        <p className="content-subtitle" style={{ marginBottom: 0 }}>No feedback yet.</p>
      )}
    </Card>
  )
}

function ConversationCard({
  feedback: f,
  onConfirm,
  onReject,
  onDelete,
  actionsPending,
}: {
  feedback: Feedback
  onConfirm?: () => void
  onReject?: () => void
  onDelete?: () => void
  actionsPending?: boolean
}) {
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 14, background: 'var(--color-bg)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <FeedbackBubbles feedback={f} viewer="admin" />
      <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.15rem', alignItems: 'center' }}>
        {onConfirm && onReject && (
          <>
            <Button size="sm" onClick={onConfirm} disabled={actionsPending}>Confirm</Button>
            <Button size="sm" variant="danger" onClick={onReject} disabled={actionsPending}>Reject</Button>
          </>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            disabled={actionsPending}
            title="Delete permanently"
            style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--color-danger, #ef4444)', cursor: actionsPending ? 'default' : 'pointer', fontSize: '0.78rem', padding: '0.25rem 0.4rem' }}
          >
            🗑 Delete
          </button>
        )}
      </div>
    </div>
  )
}
