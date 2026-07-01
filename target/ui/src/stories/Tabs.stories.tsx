import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export const name = 'Tabs'
export const stories = [
  {
    name: 'Default',
    element: (
      <Tabs defaultValue="a" className="w-72">
        <TabsList>
          <TabsTrigger value="a">Account</TabsTrigger>
          <TabsTrigger value="b">Password</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Account</TabsContent>
        <TabsContent value="b">Password</TabsContent>
      </Tabs>
    ),
  },
]
