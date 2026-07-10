'use client'
import Image from 'next/image'
import Link from 'next/link'
import { urlFor } from '@/lib/sanity'
import type { CanvasItem as CanvasItemType } from '@/lib/types'
import PostIt from './PostIt'
import { useVideoLazySrc } from './useVideoBlobSrc'

const DEFAULT_WIDTH = 400

function ItemLink({ href, className, style, children }: { href: string | null; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  if (href) return <Link href={href} className={className} style={style}>{children}</Link>
  return <div className={className} style={style}>{children}</div>
}

function CanvasVideo({ src, w, h }: { src: string; w: number; h: number }) {
  const { ref, src: lazySrc } = useVideoLazySrc(src)
  return (
    <video
      ref={ref}
      src={lazySrc}
      autoPlay
      loop
      muted
      playsInline
      draggable={false}
      style={{ width: w, height: h }}
      className="object-cover max-w-none"
    />
  )
}

export default function CanvasItem({ item, locale, width, height }: { item: CanvasItemType; locale: string; width?: number; height?: number }) {
  const w = width ?? DEFAULT_WIDTH
  const h = height ?? Math.round(w * 0.75)
  const projectSlug = item.linkedProject?.slug?.current
  const href = projectSlug ? `/${locale}/projects/${projectSlug}` : null

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
            <p className="font-build text-lg text-via-black mt-1 text-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ width: w }}>{item.credit}</p>
          )}
        </ItemLink>
      )
    }

    if (item.image) {
      const imageUrl = urlFor(item.image).width(w * 2).url()
      return (
        <ItemLink href={href} className={href ? 'group block' : 'group'}>
          <Image
            src={imageUrl}
            alt=""
            width={w}
            height={h}
            style={{ width: w, height: h }}
            className="object-cover max-w-none"
            draggable={false}
            priority
          />
          {item.credit && (
            <p className="font-build text-lg text-via-black mt-1 text-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ width: w }}>{item.credit}</p>
          )}
        </ItemLink>
      )
    }
  }

  return null
}
