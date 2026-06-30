import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Button } from './Button'

describe('Button (frozen acceptance)', () => {
  it('renders a native button with its accessible name', () => {
    render(<Button>Save</Button>)
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn).toBeInTheDocument()
    expect(btn.tagName).toBe('BUTTON')
  })

  it('renders all variant x size combinations', () => {
    const variants = ['primary', 'secondary', 'ghost'] as const
    const sizes = ['sm', 'md'] as const
    for (const variant of variants) for (const size of sizes) {
      render(<Button variant={variant} size={size}>X</Button>)
    }
    expect(screen.getAllByRole('button')).toHaveLength(6)
  })

  it('is disabled when disabled', () => {
    render(<Button disabled>Save</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('is busy and non-interactive when loading', () => {
    render(<Button loading>Save</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(btn).toBeDisabled()
  })

  it('has zero axe violations across variants and states', async () => {
    const { container } = render(
      <div>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
      </div>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
