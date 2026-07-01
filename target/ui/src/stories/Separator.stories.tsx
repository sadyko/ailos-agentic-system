import { Separator } from '@/components/ui/separator'

export const name = 'Separator'
export const stories = [
  {
    name: 'Default',
    element: (
      <div className="w-48">
        <span>Above</span>
        <Separator className="my-2" />
        <span>Below</span>
      </div>
    ),
  },
]
