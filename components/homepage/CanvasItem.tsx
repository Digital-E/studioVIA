'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { urlFor } from '@/lib/sanity'
import type { CanvasItem as CanvasItemType } from '@/lib/types'
import PostIt from './PostIt'
import { useVideoBlobSrc } from './useVideoBlobSrc'

const DEFAULT_WIDTH = 400

// Fades an image in once its own network fetch/decode actually finishes,
// independent of the canvas's own reveal animation — without this, any
// image not already warm in the browser cache (a slow network, an evicted
// cache entry) just pops in the instant it's ready, with nothing masking it
// once the reveal itself is no longer animating (e.g. a same-session reload,
// which skips the reveal entirely). `onLoad` alone misses images that were
// already cached and loaded before React attached the listener, which would
// leave them stuck invisible forever — checking `.complete` on mount catches
// that case. That check has to be a *layout* effect, not a regular one — a
// regular effect only runs after the first paint, so even an already-cached
// image would render blank for one guaranteed frame before the check ever
// ran. A layout effect resolves it before that first paint instead, so a
// cached image (the common case, especially on reload) never blanks at all;
// a genuinely slow one still fades in via `onLoad` once it's ready.
function useImageLoaded() {
  const ref = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)
  useLayoutEffect(() => {
    if (ref.current?.complete) setLoaded(true)
  }, [])
  return { ref, loaded, onLoad: () => setLoaded(true) }
}

// Same idea as useImageLoaded, for <video>: fades in once a frame is
// actually decoded and ready to show, instead of popping in with no
// transition the instant the browser has something to paint — true whether
// that data came from a slow fetch or was already sitting in the blob cache
// (see useVideoBlobSrc) from an earlier visit. `readyState` is the video
// equivalent of an image's `.complete` — checked on every `blobUrl` change
// (not just on mount) since useVideoBlobSrc can hand this a cached blob URL
// well after the initial render, at which point a fresh `loadeddata` may
// already have been missed.
function useVideoLoaded(ref: RefObject<HTMLVideoElement | null>, blobUrl: string | null) {
  const [loaded, setLoaded] = useState(false)
  useLayoutEffect(() => {
    setLoaded((ref.current?.readyState ?? 0) >= 2) // HAVE_CURRENT_DATA
  }, [ref, blobUrl])
  return { loaded, onLoadedData: () => setLoaded(true) }
}

function ItemLink({ href, className, style, children }: { href: string | null; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  if (href) return <Link href={href} className={className} style={style}>{children}</Link>
  return <div className={className} style={style}>{children}</div>
}

function CanvasVideo({ src, w, h }: { src: string; w: number; h: number }) {
  const { ref, blobUrl } = useVideoBlobSrc(src)
  const { loaded, onLoadedData } = useVideoLoaded(ref, blobUrl)
  return (
    <video
      ref={ref}
      src={blobUrl ?? undefined}
      autoPlay
      loop
      muted
      playsInline
      draggable={false}
      style={{ width: w, height: h, opacity: loaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
      className="object-cover max-w-none"
      onLoadedData={onLoadedData}
    />
  )
}

export default function CanvasItem({ item, locale, width, height }: { item: CanvasItemType; locale: string; width?: number; height?: number }) {
  const w = width ?? DEFAULT_WIDTH
  const h = height ?? Math.round(w * 0.75)
  const projectSlug = item.linkedProject?.slug?.current
  const href = projectSlug ? `/${locale}/projects/${projectSlug}` : null
  // Called unconditionally (rules of hooks) even though only the plain-image
  // branch below uses it.
  const image = useImageLoaded()

  if (item._type === 'canvasPostit') {
    return (
      <ItemLink href={href} className={href ? 'block' : undefined} style={{ width: w, height: h }}>
        <PostIt item={item} locale={locale} />
      </ItemLink>
    )
  }

  if (item._type === 'canvasMedia') {
    if (item.video?.asset?.url) {
      return (
        <ItemLink href={href} className={href ? 'group block' : 'group'}>
          <CanvasVideo src={item.video.asset.url} w={w} h={h} />
          {item.credit && (
            <p className="font-build text-lg leading-none text-via-black mt-1 text-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ width: w }}>{item.credit}</p>
          )}
        </ItemLink>
      )
    }

    if (item.image) {
      const imageUrl = urlFor(item.image).width(w * 2).url()
      return (
        <ItemLink href={href} className={href ? 'group block' : 'group'}>
          <Image
            ref={image.ref}
            src={imageUrl}
            alt=""
            width={w}
            height={h}
            style={{ width: w, height: h, opacity: image.loaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
            className="object-cover max-w-none"
            draggable={false}
            priority
            onLoad={image.onLoad}
          />
          {item.credit && (
            <p className="font-build text-lg leading-none text-via-black mt-1 text-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ width: w }}>{item.credit}</p>
          )}
        </ItemLink>
      )
    }
  }

  return null
}
