'use client'

import { useRouter } from 'next/navigation'

/**
 * A table row that opens `href` when clicked anywhere. Links and buttons
 * inside it keep their own behaviour; keyboard users use the row's own link.
 */
export function ClickableRow({ href, children, className = '' }: { href: string; children: React.ReactNode; className?: string }) {
  const router = useRouter()
  return (
    <tr
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('a, button')) return
        if (event.metaKey || event.ctrlKey) window.open(href, '_blank')
        else router.push(href)
      }}
      onMouseEnter={() => router.prefetch(href)}
      className={`cursor-pointer ${className}`}
    >
      {children}
    </tr>
  )
}
