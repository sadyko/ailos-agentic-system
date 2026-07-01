import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

export const name = 'Popover'
export const stories = [
  {
    name: 'Default',
    element: (
      <Popover>
        <PopoverTrigger asChild>
          <button>Open popover</button>
        </PopoverTrigger>
        <PopoverContent>Popover content</PopoverContent>
      </Popover>
    ),
  },
]
