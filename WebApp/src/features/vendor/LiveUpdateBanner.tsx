export function LiveUpdateBanner() {
  const message = null as string | null
  if (!message) return null
  return (
    <div className="live-update-banner" role="alert">
      ⚠ {message}
    </div>
  )
}
