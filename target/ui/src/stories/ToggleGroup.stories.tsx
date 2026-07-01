import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export const name = 'ToggleGroup'
export const stories = [
  {
    name: 'Default',
    element: (
      <ToggleGroup type="single" defaultValue="list">
        <ToggleGroupItem value="list" aria-label="List view">List</ToggleGroupItem>
        <ToggleGroupItem value="calendar" aria-label="Calendar view">Calendar</ToggleGroupItem>
      </ToggleGroup>
    ),
  },
]
