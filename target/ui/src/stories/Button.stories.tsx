import { Button } from '@/components/ui/button'

export const name = 'ShadcnButton'
export const stories = [
  { name: 'Default', element: <Button>Button</Button> },
  { name: 'Secondary', element: <Button variant="secondary">Secondary</Button> },
  { name: 'Destructive', element: <Button variant="destructive">Delete</Button> },
  { name: 'Outline', element: <Button variant="outline">Outline</Button> },
]
