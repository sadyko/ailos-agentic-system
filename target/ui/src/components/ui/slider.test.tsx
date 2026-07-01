import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Slider } from '@/components/ui/slider'

describe('ui/Slider (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <Slider defaultValue={[50]} max={100} step={1} className="w-48" aria-label="Volume" />
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
