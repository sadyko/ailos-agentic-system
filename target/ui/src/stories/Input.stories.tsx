import { Input } from '@/components/ui/input'

export const name = 'Input'
export const stories = [
  {
    name: 'Default',
    element: (
      <div><label htmlFor="i1">Email</label><Input id="i1" placeholder="you@example.com" /></div>
    ),
  },
]
