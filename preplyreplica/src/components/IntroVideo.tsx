// A directly uploaded file (public Supabase Storage URL, e.g. .../video.mp4)
// plays via the native <video> element; anything else is an external embed
// link (YouTube, Vimeo, Google Drive) and needs an <iframe>.
const VIDEO_FILE_EXTENSION = /\.(mp4|webm|mov|ogg)(\?.*)?$/i

/**
 * A teacher's intro video, played in the page. The iframe sends the page's
 * origin as referrer: YouTube refuses to play embeds without it ("Error 153").
 */
export function IntroVideo({ url, className = 'h-72 w-full' }: { url: string; className?: string }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950">
      {VIDEO_FILE_EXTENSION.test(url) ? (
        <video controls className={className} src={url} />
      ) : (
        <iframe
          className={className}
          src={url}
          title="Teacher introduction"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
    </div>
  )
}
