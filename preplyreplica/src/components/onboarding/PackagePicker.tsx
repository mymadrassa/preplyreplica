import { SelectionCard } from './SelectionCard'

const OPTIONS = [
  { value: 4, label: '4 lessons / month', description: 'Try it out at a relaxed pace.' },
  { value: 8, label: '8 lessons / month', description: 'The most popular commitment.' },
  { value: 12, label: '12 lessons / month', description: 'Best value for frequent learners.' },
] as const

export function PackagePicker({ value, onChange }: { value: 4 | 8 | 12 | null; onChange: (packageSize: 4 | 8 | 12) => void }) {
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
