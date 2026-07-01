import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from '@/components/ui/context-menu'

export const name = 'ContextMenu'
export const stories = [
  {
    name: 'Default',
    element: (
      <ContextMenu>
        <ContextMenuTrigger className="flex h-16 w-48 items-center justify-center rounded-md border text-sm">
          Right-click here
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Edit</ContextMenuItem>
          <ContextMenuItem>Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    ),
  },
]
