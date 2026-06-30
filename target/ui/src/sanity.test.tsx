import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'

describe('toolchain sanity', () => {
  it('renders and queries by role', () => {
    render(<button type="button">Hello</button>)
    expect(screen.getByRole('button', { name: 'Hello' })).toBeInTheDocument()
  })

  it('runs jest-axe with no violations on valid markup', async () => {
    const { container } = render(<button type="button">Hello</button>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
