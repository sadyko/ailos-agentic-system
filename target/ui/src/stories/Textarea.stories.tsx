import { Textarea } from '@/components/ui/textarea'

export const name = 'Textarea'
export const stories = [
  {
    name: 'Default',
    element: (
      <div><label htmlFor="t1">Message</label><Textarea id="t1" placeholder="Type…" /></div>
    ),
  },
]
