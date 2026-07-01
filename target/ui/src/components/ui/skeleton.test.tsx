import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Skeleton } from '@/components/ui/skeleton'

describe('ui/Skeleton (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <Skeleton className="h-6 w-48" />
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
