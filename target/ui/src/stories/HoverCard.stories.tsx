import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card'

export const name = 'HoverCard'
export const stories = [
  {
    name: 'Default',
    element: (
      <HoverCard>
        <HoverCardTrigger asChild>
          <button>@aurora</button>
        </HoverCardTrigger>
        <HoverCardContent>Medical information system.</HoverCardContent>
      </HoverCard>
    ),
  },
]
