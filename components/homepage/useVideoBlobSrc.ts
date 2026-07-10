'use client'
import { useEffect, useRef, useState } from 'react'

// Defers setting `src` on the returned ref's element until it's actually on
// screen, then lets the <video> download it directly (rather than via
// fetch()+blob: Sanity's file CDN — unlike its image CDN — rejects
// cross-origin `fetch()` with CORS-blocked 403s, so a blob-fetch approach
// can never resolve for these assets and the video renders as a permanently
// blank tile; a native <video src> plays cross-origin media fine since
// playback, unlike pixel access via canvas/WebGL, doesn't require CORS).
// Keeps observing for the component's lifetime so playback pauses whenever
// the video scrolls out of view and resumes when it scrolls back in —
// otherwise off-screen (but still-mounted) videos would keep decoding forever.
export function useVideoLazySrc(src: string | undefined) {
  const ref = useRef<HTMLVideoElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!src) return
    const el = ref.current
    if (!el) return

    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true)
        el.play().catch(() => {})
      } else {
        el.pause()
      }
    }, { rootMargin: '200px' })
    io.observe(el)

    return () => io.disconnect()
  }, [src])

  return { ref, src: visible ? src : undefined }
}
