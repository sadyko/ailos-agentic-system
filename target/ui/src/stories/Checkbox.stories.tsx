import { Checkbox } from '@/components/ui/checkbox'

export const name = 'Checkbox'
export const stories = [
  {
    name: 'Default',
    element: (
      <div className="flex items-center gap-2">
        <Checkbox id="c1" />
        <label htmlFor="c1">Accept</label>
      </div>
    ),
  },
]
