import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

describe('ui/Popover (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <Popover>
        <PopoverTrigger asChild>
          <button>Open popover</button>
        </PopoverTrigger>
        <PopoverContent>Popover content</PopoverContent>
      </Popover>
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
