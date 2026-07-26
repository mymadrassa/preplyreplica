// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/components/TextArea.tsx
export function TextArea({ label, className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      <span>{label}</span>
      <textarea className={`mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${className}`} {...props} />
    </label>
  )
}
