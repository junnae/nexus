export interface ErrorScreenProps {
  message: string
  onRetry: () => void
  onHome: () => void
}

export function ErrorScreen({ message, onRetry, onHome }: ErrorScreenProps) {
  return (
    <div className="status-screen" role="alert">
      <div className="status-screen__icon" aria-hidden="true">
        ⚠️
      </div>
      <h1>{message}</h1>
      <p>Try reloading the app or contact your teacher</p>
      <div className="status-screen__buttons">
        <button type="button" className="button-primary" onClick={onRetry}>
          Retry
        </button>
        <button type="button" className="button-primary" onClick={onHome}>
          Home
        </button>
      </div>
    </div>
  )
}
