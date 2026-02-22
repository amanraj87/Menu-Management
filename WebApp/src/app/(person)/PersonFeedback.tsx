import { useState } from 'react'
import { Card, Button } from '@/shared/ui'
import { useCreateFeedback } from '@/shared/graphql/hooks'
import { useToastStore } from '@/shared/stores/toastStore'

export function PersonFeedback() {
  const [text, setText] = useState('')
  const toast = useToastStore()
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
    </Card>
  )
}
