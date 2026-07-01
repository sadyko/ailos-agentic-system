import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

export const name = 'Dialog'
export const stories = [
  {
    name: 'Default',
    element: (
      <Dialog>
        <DialogTrigger asChild><button>Open</button></DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>Body</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    ),
  },
]
