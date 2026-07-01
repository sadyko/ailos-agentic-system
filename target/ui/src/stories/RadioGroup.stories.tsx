import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

export const name = 'RadioGroup'
export const stories = [
  {
    name: 'Default',
    element: (
      <RadioGroup defaultValue="comfortable">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="default" id="rg-1" />
          <label htmlFor="rg-1">Default</label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="comfortable" id="rg-2" />
          <label htmlFor="rg-2">Comfortable</label>
        </div>
      </RadioGroup>
    ),
  },
]
