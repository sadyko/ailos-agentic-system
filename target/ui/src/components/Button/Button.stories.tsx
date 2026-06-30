/** @jsxRuntime automatic */
import type { ReactElement } from 'react'
import { Button } from './Button'

type Story = { name: string; element: ReactElement }

const variants = ['primary', 'secondary', 'ghost'] as const
const sizes = ['sm', 'md'] as const

// One card per variant x size combination, plus the disabled and loading states.
const comboStories: Story[] = variants.flatMap((variant) =>
  sizes.map((size) => ({
    name: `${variant} / ${size}`,
    element: (
      <Button variant={variant} size={size}>
        {variant} {size}
      </Button>
    ),
  })),
)

export const stories: Story[] = [
  ...comboStories,
  {
    name: 'disabled',
    element: <Button disabled>Disabled</Button>,
  },
  {
    name: 'loading',
    element: <Button loading>Loading</Button>,
  },
]
