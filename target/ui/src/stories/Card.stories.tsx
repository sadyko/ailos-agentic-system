import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export const name = 'Card'
export const stories = [
  {
    name: 'Default',
    element: (
      <Card className="w-72">
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Content</CardContent>
      </Card>
    ),
  },
]
