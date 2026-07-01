import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Progress } from '@/components/ui/progress'

describe('ui/Progress (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <Progress value={60} aria-label="Loading progress" className="w-48" />
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
