import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

describe('ui/ToggleGroup (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <ToggleGroup type="single" defaultValue="list">
        <ToggleGroupItem value="list" aria-label="List view">List</ToggleGroupItem>
        <ToggleGroupItem value="calendar" aria-label="Calendar view">Calendar</ToggleGroupItem>
      </ToggleGroup>
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
