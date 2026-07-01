import { Slider } from '@/components/ui/slider'

export const name = 'Slider'
export const stories = [
  {
    name: 'Default',
    element: (
      <Slider defaultValue={[50]} max={100} step={1} className="w-48" aria-label="Volume" />
    ),
  },
]
