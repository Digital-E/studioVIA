'use client'
import Image from 'next/image'
import { urlFor } from '@/lib/sanity'
import type { CanvasItem as CanvasItemType } from '@/lib/types'
import PostIt from './PostIt'

const DEFAULT_WIDTH = 400

export default function CanvasItem({ item, locale }: { item: CanvasItemType; locale: string }) {
  const w = DEFAULT_WIDTH

  if (item._type === 'canvasPostit') {
    return (
      <div style={{ width: w, height: Math.round(w * 1.1) }}>
        <PostIt item={item} locale={locale} />
      </div>
    )
  }

  if (item._type === 'canvasMedia') {
    if (item.mediaType === 'video' && item.videoUrl) {
      return (
        <video
          src={item.videoUrl}
          autoPlay
          loop
          muted
          playsInline
          style={{ width: w, height: Math.round(w * 0.75) }}
          className="object-cover max-w-none"
        />
      )
    }

    if (item.image) {
      const imageUrl = urlFor(item.image).width(w * 2).url()
      return (
        <Image
          src={imageUrl}
          alt=""
          width={w}
          height={Math.round(w * 0.75)}
          className="object-cover max-w-none"
          draggable={false}
          priority
        />
      )
    }
  }

  return null
}
