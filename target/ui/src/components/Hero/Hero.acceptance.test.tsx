import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Hero } from './Hero'

describe('Hero (frozen acceptance)', () => {
  it('renders exactly one h1 from the title', () => {
    render(<Hero title="Build better" animate={false} />)
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0].textContent).toContain('Build better')
  })
  it('renders both CTAs with accessible names', () => {
    render(<Hero animate={false} primaryCta={{ label: 'Get started', href: '#go' }} secondaryCta={{ label: 'Book a call', href: '#call' }} />)
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /book a call/i })).toBeInTheDocument()
  })
  it('renders the dashboard mock with a text alternative', () => {
    render(<Hero animate={false} />)
    expect(screen.getByRole('img', { name: /dashboard/i })).toBeInTheDocument()
  })
  it('is de-branded (no "efferd")', () => {
    const { container } = render(<Hero animate={false} />)
    expect(container.innerHTML.toLowerCase()).not.toContain('efferd')
  })
  it('has zero axe violations (static render)', async () => {
    const { container } = render(<Hero animate={false} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
