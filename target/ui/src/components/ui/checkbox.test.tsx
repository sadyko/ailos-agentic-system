import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Checkbox } from '@/components/ui/checkbox'

describe('ui/Checkbox (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <div className="flex items-center gap-2">
        <Checkbox id="c1" />
        <label htmlFor="c1">Accept</label>
      </div>
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
