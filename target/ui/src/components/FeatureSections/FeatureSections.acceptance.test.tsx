import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { FeatureSections } from './FeatureSections'

describe('FeatureSections (frozen acceptance)', () => {
  it('renders a section heading from the title prop', () => {
    render(<FeatureSections title={'Hello\nworld'} animate={false} />)
    const h2 = screen.getByRole('heading', { level: 2 })
    expect(h2).toBeInTheDocument()
    expect(h2.textContent).toContain('Hello')
  })
  it('renders the badge', () => {
    render(<FeatureSections badge="Test badge" animate={false} />)
    expect(screen.getByText('Test badge')).toBeInTheDocument()
  })
  it('renders six feature cards by default, each with a level-3 title', () => {
    render(<FeatureSections animate={false} />)
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(6)
  })
  it('is de-branded (no "Wiza")', () => {
    const { container } = render(<FeatureSections animate={false} />)
    expect(container.innerHTML.toLowerCase()).not.toContain('wiza')
  })
  it('has zero axe violations (static render)', async () => {
    const { container } = render(<FeatureSections animate={false} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
