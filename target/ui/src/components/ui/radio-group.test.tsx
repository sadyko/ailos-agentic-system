import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

describe('ui/RadioGroup (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <RadioGroup defaultValue="comfortable">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="default" id="rg-1" />
          <label htmlFor="rg-1">Default</label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="comfortable" id="rg-2" />
          <label htmlFor="rg-2">Comfortable</label>
        </div>
      </RadioGroup>
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
