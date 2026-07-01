import { ScrollArea } from '@/components/ui/scroll-area'

export const name = 'ScrollArea'
export const stories = [
  {
    name: 'Default',
    element: (
      <ScrollArea className="h-24 w-48 rounded-md border p-3 text-sm">
        Jokester began sneaking into the castle and leaving jokes all over the place.
      </ScrollArea>
    ),
  },
]
