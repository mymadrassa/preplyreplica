import { describeTags } from '@/lib/sessionFeedback'

/** A teacher's quick tags about a lesson: green for what went well, amber for what to work on. */
export function FeedbackTags({ tags, className = '' }: { tags: string[]; className?: string }) {
  const described = describeTags(tags)
  if (!described.length) return null
  return (
    <span className={`flex flex-wrap gap-1 ${className}`}>
      {described.map((tag) => (
        <span
          key={tag.key}
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tag.encouraging ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}
        >
          {tag.label}
        </span>
      ))}
    </span>
  )
}
