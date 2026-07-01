import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

export const name = 'Select'
export const stories = [
  {
    name: 'Default',
    element: (
      <Select>
        <SelectTrigger aria-label="Fruit" className="w-48">
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Apple</SelectItem>
          <SelectItem value="b">Banana</SelectItem>
        </SelectContent>
      </Select>
    ),
  },
]
