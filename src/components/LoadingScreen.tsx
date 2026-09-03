export function LoadingScreen() {
  return (
    <div className="status-screen" role="status" aria-live="polite">
      <div className="status-screen__spinner" aria-hidden="true" />
      <h1>Loading...</h1>
      <p>Hang on, I'm getting your words ready</p>
    </div>
  )
}
