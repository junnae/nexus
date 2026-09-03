export interface GameControlsProps {
  score: number
  totalWords: number
  currentIndex: number
  onHelp: () => void
  onSettings: () => void
}

export function GameControls({ score, totalWords, currentIndex, onHelp, onSettings }: GameControlsProps) {
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
