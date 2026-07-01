import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Separator } from '@/components/ui/separator'

describe('ui/Separator (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <div className="w-48">
        <span>Above</span>
        <Separator className="my-2" />
        <span>Below</span>
      </div>
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
