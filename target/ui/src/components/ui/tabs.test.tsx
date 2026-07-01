import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

describe('ui/Tabs (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <Tabs defaultValue="a" className="w-72">
        <TabsList>
          <TabsTrigger value="a">Account</TabsTrigger>
          <TabsTrigger value="b">Password</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Account</TabsContent>
        <TabsContent value="b">Password</TabsContent>
      </Tabs>
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
