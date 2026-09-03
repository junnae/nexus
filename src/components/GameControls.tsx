export interface GameControlsProps {
  score: number
  totalWords: number
  currentIndex: number
  onReplay?: () => void
  replayLabel?: string
  onHelp: () => void
  onSettings: () => void
}

function SpeakerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      <path
        d="M16.5 8.5a5 5 0 0 1 0 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M19 6a9 9 0 0 1 0 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
    </svg>
  )
}

export function GameControls({
  score,
  totalWords,
  currentIndex,
  onReplay,
  replayLabel = 'Replay word',
  onHelp,
  onSettings,
}: GameControlsProps) {
  return (
    <header className="game-header">
      <div className="game-header__scores">
        <span className="game-header__score">
          Score: {score}/{totalWords}
        </span>
        <span className="game-header__progress">
          Word {currentIndex + 1} of {totalWords}
        </span>
      </div>
      <div className="game-header__buttons">
        {onReplay && (
          <button type="button" className="icon-button" aria-label={replayLabel} onClick={onReplay}>
            <SpeakerIcon />
          </button>
        )}
        <button type="button" className="icon-button" aria-label="Help" onClick={onHelp}>
          ?
        </button>
        <button type="button" className="icon-button" aria-label="Settings" onClick={onSettings}>
          ⚙
        </button>
      </div>
    </header>
  )
}
