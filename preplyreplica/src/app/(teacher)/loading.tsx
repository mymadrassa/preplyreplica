import { LoadingBlock } from '@/components/LoadingBlock'

// Shown inside the sidebar layout the moment a link is clicked, until the page's data arrives.
export default function Loading() {
  return (
    <main className="container mx-auto px-4 py-12">
      <LoadingBlock label="Loading…" />
    </main>
  )
}
