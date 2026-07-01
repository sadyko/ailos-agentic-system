import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

describe('ui/Avatar (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="" alt="" />
        <AvatarFallback>JL</AvatarFallback>
      </Avatar>
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
