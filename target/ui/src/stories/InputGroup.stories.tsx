import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupText } from '@/components/ui/input-group'

export const name = 'InputGroup'
export const stories = [
  {
    name: 'Default',
    element: (
      <InputGroup className="w-64">
        <InputGroupAddon>
          <InputGroupText>@</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput aria-label="Username" placeholder="username" />
      </InputGroup>
    ),
  },
]
