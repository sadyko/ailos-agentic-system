import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Toaster } from '@/components/ui/sonner'

describe('ui/Sonner (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <Toaster />
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
