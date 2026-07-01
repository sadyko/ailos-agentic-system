import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'

describe('ui/Command (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <Command className="w-64 rounded-lg border">
        <CommandInput placeholder="Type a command…" aria-label="Command search" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem>Calendar</CommandItem>
            <CommandItem>Search</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
