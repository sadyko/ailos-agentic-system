import { Label } from '@/components/ui/label'

export const name = 'Label'
export const stories = [
  {
    name: 'Default',
    element: (
      <div><Label htmlFor="l1">Name</Label><input id="l1" /></div>
    ),
  },
]
