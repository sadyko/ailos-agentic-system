import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  )
}

export default function App() {
  return (
    <TooltipProvider>
      <main className="mx-auto max-w-4xl space-y-10 px-6 py-12">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Component Library</h1>
          <p className="mt-1 text-muted-foreground">
            shadcn-native, themed with the project brand. Everything below is live and interactive.
          </p>
        </header>

        <Section title="Buttons">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="ghost">Ghost</Button>
        </Section>

        <Section title="Badges">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </Section>

        <Section title="Form (type, pick, toggle)">
          <div className="w-72 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" placeholder="you@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="msg">Message</Label>
              <Textarea id="msg" placeholder="Type a message…" />
            </div>
            <Select>
              <SelectTrigger aria-label="Plan" className="w-full">
                <SelectValue placeholder="Choose a plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="team">Team</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Checkbox id="tos" />
              <Label htmlFor="tos">Accept terms</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="wifi" />
              <Label htmlFor="wifi">Wi-Fi</Label>
            </div>
          </div>
        </Section>

        <Section title="Card & Tabs">
          <Card className="w-72">
            <CardHeader>
              <CardTitle>Project</CardTitle>
              <CardDescription>A short description of the project.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Card body content goes here.</CardContent>
          </Card>
          <Tabs defaultValue="account" className="w-80">
            <TabsList>
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="password">Password</TabsTrigger>
            </TabsList>
            <TabsContent value="account" className="pt-2 text-sm text-muted-foreground">Manage your account here.</TabsContent>
            <TabsContent value="password" className="pt-2 text-sm text-muted-foreground">Change your password here.</TabsContent>
          </Tabs>
        </Section>

        <Section title="Overlays (click / hover)">
          <Dialog>
            <DialogTrigger asChild><Button>Open dialog</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dialog title</DialogTitle>
                <DialogDescription>A working modal — press Esc or click outside to close.</DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
          <Tooltip>
            <TooltipTrigger asChild><Button variant="outline">Hover me</Button></TooltipTrigger>
            <TooltipContent>A tooltip</TooltipContent>
          </Tooltip>
        </Section>

        <Section title="Misc">
          <Avatar><AvatarFallback>JL</AvatarFallback></Avatar>
          <div className="w-48">
            <span className="text-sm">Above</span>
            <Separator className="my-2" />
            <span className="text-sm">Below</span>
          </div>
        </Section>

        <Alert className="max-w-md">
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>Everything on this page is a live, interactive component.</AlertDescription>
        </Alert>
      </main>
    </TooltipProvider>
  )
}
