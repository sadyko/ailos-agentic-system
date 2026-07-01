import { Badge } from '@/components/ui/badge'

export const name = 'Badge'
export const stories = [
  {
    name: 'Default',
    element: (
      <div className="flex gap-2">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="destructive">Destructive</Badge>
      </div>
    ),
  },
]
