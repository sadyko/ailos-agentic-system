import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Button } from '@/components/ui/button'

describe('ui/Button (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(<Button>Save</Button>)
    expect(container.querySelector('button')).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
