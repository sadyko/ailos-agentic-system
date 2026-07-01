import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'

describe('ui/Collapsible (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <Collapsible className="w-72">
        <CollapsibleTrigger asChild>
          <button>Toggle details</button>
        </CollapsibleTrigger>
        <CollapsibleContent>Hidden content revealed on toggle.</CollapsibleContent>
      </Collapsible>
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
