import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { ScrollArea } from '@/components/ui/scroll-area'

describe('ui/ScrollArea (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <ScrollArea className="h-24 w-48 rounded-md border p-3 text-sm">
        Jokester began sneaking into the castle and leaving jokes all over the place.
      </ScrollArea>
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
