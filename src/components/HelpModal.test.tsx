import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HelpModal } from './HelpModal'

describe('HelpModal', () => {
  it('renders how-to-play instructions', () => {
    render(<HelpModal onClose={() => {}} />)
    expect(screen.getByText('How to Play')).toBeInTheDocument()
    expect(screen.getByText(/Drag the letters/)).toBeInTheDocument()
  })

  it('calls onClose from the close icon and the Close button', () => {
    const onClose = vi.fn()
    render(<HelpModal onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close help' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
