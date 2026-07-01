import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Input } from '@/components/ui/input'

describe('ui/Input (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <div><label htmlFor="i1">Email</label><Input id="i1" placeholder="you@example.com" /></div>
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
