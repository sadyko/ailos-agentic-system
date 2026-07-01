import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Calendar } from '@/components/ui/calendar'

describe('ui/Calendar (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <Calendar mode="single" className="rounded-md border" />
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
