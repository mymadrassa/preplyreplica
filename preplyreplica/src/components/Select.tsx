// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/components/Select.tsx
export function Select({ label, options, className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      <span>{label}</span>
      <select className={`mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${className}`} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}
