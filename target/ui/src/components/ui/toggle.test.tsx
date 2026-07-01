import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Toggle } from '@/components/ui/toggle'

describe('ui/Toggle (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <Toggle aria-label="Toggle bold">B</Toggle>
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
