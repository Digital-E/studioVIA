'use client'
import { useEffect, useRef, useState } from 'react'

// Module-level so every CanvasItem instance — including repeated tile copies
// and remounts caused by panning in/out of view — shares one download per
// source URL instead of re-fetching, and reuses it for the life of the page.
const blobCache = new Map<string, string>()
const inFlight = new Map<string, Promise<string>>()

function loadBlobUrl(src: string): Promise<string> {
  const cached = blobCache.get(src)
  if (cached) return Promise.resolve(cached)

  let promise = inFlight.get(src)
  if (!promise) {
    promise = fetch(src)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        blobCache.set(src, url)
        return url
      })
      .finally(() => inFlight.delete(src))
    inFlight.set(src, promise)
  }
  return promise
}

// Defers downloading `src` until the returned ref's element is actually on
// screen, then resolves to a blob: URL backed by the shared cache above.
// Keeps observing for the component's lifetime so playback pauses whenever
// the video scrolls out of view and resumes when it scrolls back in —
// otherwise off-screen (but still-mounted) videos would keep decoding forever.
export function useVideoBlobSrc(src: string | undefined) {
  const ref = useRef<HTMLVideoElement>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(() => (src ? blobCache.get(src) ?? null : null))

  useEffect(() => {
    if (!src) return
    const el = ref.current
    if (!el) return

    let cancelled = false
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        // Always resolve through loadBlobUrl, even if blobCache already has
        // this src — it short-circuits to the cached URL synchronously, but
        // still needs to reach setBlobUrl so *this* instance's local state
        // picks it up. A cache-only guard here would skip that for every
        // instance after the first (e.g. a repeated tile, or the same item
        // panned to again later), leaving its blobUrl stuck at null forever.
        loadBlobUrl(src).then((url) => { if (!cancelled) setBlobUrl(url) })
        el.play().catch(() => {})
      } else {
        el.pause()
      }
    }, { rootMargin: '200px' })
    io.observe(el)

    return () => { cancelled = true; io.disconnect() }
  }, [src])

  return { ref, blobUrl }
}
