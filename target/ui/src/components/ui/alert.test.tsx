import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

describe('ui/Alert (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <Alert className="w-80">
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>Something to note.</AlertDescription>
      </Alert>
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
