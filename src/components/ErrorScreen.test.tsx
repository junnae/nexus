import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorScreen } from './ErrorScreen'

describe('ErrorScreen', () => {
  it('shows the error message', () => {
    render(<ErrorScreen message="Failed to load word list." onRetry={() => {}} onHome={() => {}} />)
    expect(screen.getByText('Failed to load word list.')).toBeInTheDocument()
  })

  it('calls onRetry when Retry is tapped', () => {
    const onRetry = vi.fn()
    render(<ErrorScreen message="Oops" onRetry={onRetry} onHome={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('calls onHome when Home is tapped', () => {
    const onHome = vi.fn()
    render(<ErrorScreen message="Oops" onRetry={() => {}} onHome={onHome} />)
    fireEvent.click(screen.getByRole('button', { name: 'Home' }))
    expect(onHome).toHaveBeenCalledTimes(1)
  })
})
