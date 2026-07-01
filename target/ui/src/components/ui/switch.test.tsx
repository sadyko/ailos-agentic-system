import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Switch } from '@/components/ui/switch'

describe('ui/Switch (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <div className="flex items-center gap-2">
        <Switch id="s1" />
        <label htmlFor="s1">Wifi</label>
      </div>
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
