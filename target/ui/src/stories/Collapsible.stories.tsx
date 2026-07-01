import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'

export const name = 'Collapsible'
export const stories = [
  {
    name: 'Default',
    element: (
      <Collapsible className="w-72">
        <CollapsibleTrigger asChild>
          <button>Toggle details</button>
        </CollapsibleTrigger>
        <CollapsibleContent>Hidden content revealed on toggle.</CollapsibleContent>
      </Collapsible>
    ),
  },
]
