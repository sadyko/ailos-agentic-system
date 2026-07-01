import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupText } from '@/components/ui/input-group'

describe('ui/InputGroup (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <InputGroup className="w-64">
        <InputGroupAddon>
          <InputGroupText>@</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput aria-label="Username" placeholder="username" />
      </InputGroup>
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
