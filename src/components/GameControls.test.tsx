import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GameControls } from './GameControls'

describe('GameControls', () => {
  it('displays score and progress', () => {
    render(<GameControls score={2} totalWords={10} currentIndex={4} onHelp={() => {}} onSettings={() => {}} />)
    expect(screen.getByText('Score: 2/10')).toBeInTheDocument()
    expect(screen.getByText('Word 5 of 10')).toBeInTheDocument()
  })

  it('calls onHelp when the help button is clicked', () => {
    const onHelp = vi.fn()
    render(<GameControls score={0} totalWords={10} currentIndex={0} onHelp={onHelp} onSettings={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Help' }))
    expect(onHelp).toHaveBeenCalledTimes(1)
  })

  it('calls onSettings when the settings button is clicked', () => {
    const onSettings = vi.fn()
    render(<GameControls score={0} totalWords={10} currentIndex={0} onHelp={() => {}} onSettings={onSettings} />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(onSettings).toHaveBeenCalledTimes(1)
  })

  it('shows the replay control only when a replay callback is available', () => {
    const onReplay = vi.fn()
    const { rerender } = render(
      <GameControls
        score={0}
        totalWords={10}
        currentIndex={0}
        onReplay={onReplay}
        replayLabel="Play the word cat again"
        onHelp={() => {}}
        onSettings={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Play the word cat again' }))
    expect(onReplay).toHaveBeenCalledTimes(1)

    rerender(<GameControls score={0} totalWords={10} currentIndex={0} onHelp={() => {}} onSettings={() => {}} />)
    expect(screen.queryByRole('button', { name: /play the word/i })).not.toBeInTheDocument()
  })
})
