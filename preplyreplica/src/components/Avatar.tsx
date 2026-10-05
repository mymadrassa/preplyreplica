import { UserCircle } from 'lucide-react'

interface AvatarProps {
  name?: string | null
  avatarUrl?: string | null
  size?: 'sm' | 'md'
  className?: string
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-12 w-12 text-sm',
}

function initials(name: string | null | undefined) {
  if (!name) return null
  const value = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  return value || null
}

/** A user's avatar: their uploaded picture if they have one, else initials from their name, else a generic person icon — never a bare "?". */
export function Avatar({ name, avatarUrl, size = 'sm', className = '' }: AvatarProps) {
  const sizeClass = SIZE_CLASSES[size]

  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt={name || 'Avatar'} className={`${sizeClass} flex-shrink-0 rounded-full object-cover ${className}`} />
  }

  const label = initials(name)
  if (label) {
    return (
      <span className={`flex ${sizeClass} flex-shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 ${className}`}>
        {label}
      </span>
    )
  }

  return (
    <span className={`flex ${sizeClass} flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 ${className}`}>
      <UserCircle className="h-full w-full" aria-hidden="true" />
    </span>
  )
}
