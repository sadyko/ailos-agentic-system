import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

export const name = 'Alert'
export const stories = [
  {
    name: 'Default',
    element: (
      <Alert className="w-80">
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>Something to note.</AlertDescription>
      </Alert>
    ),
  },
]
