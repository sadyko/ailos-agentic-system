import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

export const name = 'Avatar'
export const stories = [
  {
    name: 'Default',
    element: (
      <Avatar>
        <AvatarImage src="" alt="" />
        <AvatarFallback>JL</AvatarFallback>
      </Avatar>
    ),
  },
]
