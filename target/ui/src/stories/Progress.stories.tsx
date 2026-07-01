import { Progress } from '@/components/ui/progress'

export const name = 'Progress'
export const stories = [
  {
    name: 'Default',
    element: (
      <Progress value={60} aria-label="Loading progress" className="w-48" />
    ),
  },
]
