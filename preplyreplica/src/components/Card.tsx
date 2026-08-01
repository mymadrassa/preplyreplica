// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/components/Card.tsx
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card ${className}`}>
      {children}
    </div>
  )
}
