// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/components/RatingStars.tsx
import { Star } from 'lucide-react'

export function RatingStars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  const stars = Array.from({ length: 5 }, (_, index) => index + 1)
  const starClass = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
  return (
    <div className="flex items-center gap-0.5 text-amber-500" role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {stars.map((star) => (
        <Star key={star} className={starClass} fill={star <= Math.round(value) ? 'currentColor' : 'none'} strokeWidth={1.5} aria-hidden="true" />
      ))}
    </div>
  )
}
