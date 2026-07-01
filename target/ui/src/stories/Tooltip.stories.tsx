import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

export const name = 'Tooltip'
export const stories = [
  {
    name: 'Default',
    element: (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild><button>Hover</button></TooltipTrigger>
          <TooltipContent>Tip</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ),
  },
]
