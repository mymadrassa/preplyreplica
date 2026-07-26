// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/components/RatingStars.tsx
export function RatingStars({ value }: { value: number }) {
  const stars = Array.from({ length: 5 }, (_, index) => index + 1)
  return (
    <div className="flex items-center gap-1 text-amber-500">
      {stars.map((star) => (
        <span key={star}>{star <= Math.round(value) ? '★' : '☆'}</span>
      ))}
    </div>
  )
}
