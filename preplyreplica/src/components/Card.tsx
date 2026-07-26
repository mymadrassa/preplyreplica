// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/components/Card.tsx
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-soft ${className}`}>
      {children}
    </div>
  )
}
