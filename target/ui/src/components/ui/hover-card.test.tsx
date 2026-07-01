import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card'

describe('ui/HoverCard (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <HoverCard>
        <HoverCardTrigger asChild>
          <button>@aurora</button>
        </HoverCardTrigger>
        <HoverCardContent>Medical information system.</HoverCardContent>
      </HoverCard>
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
