import { Calendar } from '@/components/ui/calendar'

export const name = 'Calendar'
export const stories = [
  {
    name: 'Default',
    element: (
      <Calendar mode="single" className="rounded-md border" />
    ),
  },
]
