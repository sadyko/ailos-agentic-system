import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Label } from '@/components/ui/label'

describe('ui/Label (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <div><Label htmlFor="l1">Name</Label><input id="l1" /></div>
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
