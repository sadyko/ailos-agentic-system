import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'

export const name = 'Command'
export const stories = [
  {
    name: 'Default',
    element: (
      <Command className="w-64 rounded-lg border">
        <CommandInput placeholder="Type a command…" aria-label="Command search" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem>Calendar</CommandItem>
            <CommandItem>Search</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    ),
  },
]
