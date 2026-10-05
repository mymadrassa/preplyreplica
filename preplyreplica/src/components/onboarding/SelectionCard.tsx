import clsx from 'clsx'

export function SelectionCard({
  label,
  description,
  selected,
  onClick,
}: {
  label: string
  description?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        'w-full rounded-2xl border p-4 text-left shadow-card transition-all hover:-translate-y-px hover:shadow-lift',
        selected ? 'border-brand-600 ring-2 ring-brand-600 bg-brand-50' : 'border-slate-200/80 bg-white'
      )}
    >
      <p className="font-semibold text-slate-900">{label}</p>
      {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
    </button>
  )
}
