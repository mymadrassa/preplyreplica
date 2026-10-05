import { SelectionCard } from './SelectionCard'

const OPTIONS = [
  { value: 1, label: '1x per week', description: 'A steady weekly check-in.' },
  { value: 2, label: '2x per week', description: 'Faster progress with twice-weekly lessons.' },
  { value: 3, label: '3x per week', description: 'Immersive pace for quick results.' },
] as const

export function RhythmPicker({ value, onChange }: { value: 1 | 2 | 3 | null; onChange: (rhythm: 1 | 2 | 3) => void }) {
  return (
    <div className="grid gap-3">
      {OPTIONS.map((option) => (
        <SelectionCard
          key={option.value}
          label={option.label}
          description={option.description}
          selected={value === option.value}
          onClick={() => onChange(option.value)}
        />
      ))}
    </div>
  )
}
