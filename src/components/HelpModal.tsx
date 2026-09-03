export interface HelpModalProps {
  onClose: () => void
}

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="How to play">
      <div className="modal-content">
        <button type="button" className="icon-button modal-close" aria-label="Close help" onClick={onClose}>
          ✕
        </button>
        <h2>How to Play</h2>
        <ol>
          <li>Tap the word to hear it and watch it scatter</li>
          <li>Drag the letters in the right order</li>
          <li>Tap a slot to drop the letter</li>
        </ol>
        <p>✓ Green = You got it!</p>
        <p>✗ Red = Try again</p>
        <button type="button" className="button-primary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
