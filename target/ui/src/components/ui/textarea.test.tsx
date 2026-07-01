import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Textarea } from '@/components/ui/textarea'

describe('ui/Textarea (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <div><label htmlFor="t1">Message</label><Textarea id="t1" placeholder="Type…" /></div>
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
