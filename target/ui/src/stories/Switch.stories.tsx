import { Switch } from '@/components/ui/switch'

export const name = 'Switch'
export const stories = [
  {
    name: 'Default',
    element: (
      <div className="flex items-center gap-2">
        <Switch id="s1" />
        <label htmlFor="s1">Wifi</label>
      </div>
    ),
  },
]
