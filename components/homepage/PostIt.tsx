'use client'
import Image from 'next/image'
import { PortableText } from '@portabletext/react'
import { urlFor } from '@/lib/sanity'
import type { CanvasItem } from '@/lib/types'

interface PostItProps {
  item: CanvasItem
  locale: string
}

const titleComponents = {
  block: {
    normal: ({ children }: { children: React.ReactNode }) => (
      <p className="font-build text-sm leading-snug font-medium">{children}</p>
    ),
  },
}

export default function PostIt({ item, locale }: PostItProps) {
  const titleBlocks = locale === 'de' ? item.title?.de : (item.title?.en ?? item.title?.de)
  const backImageUrl = item.backImage ? urlFor(item.backImage).width(600).url() : null

  return (
    <div className="postit-card w-full h-full" style={{ minHeight: '220px' }}>
      <div className="postit-inner w-full h-full">
        {/* Front: yellow post-it */}
        <div className="postit-front flex flex-col p-5" style={{ backgroundColor: 'var(--color-postit)' }}>
          <div className="flex justify-between items-start mb-auto">
            <span className="font-build text-xs font-medium">{item.category}</span>
            <span className="font-build text-xs text-via-gray">{item.date}</span>
          </div>
          <div className="mt-8">
            {titleBlocks && (
              <PortableText value={titleBlocks as Parameters<typeof PortableText>[0]['value']} components={titleComponents} />
            )}
          </div>
        </div>

        {/* Back: image */}
        <div className="postit-back w-full h-full overflow-hidden">
          {backImageUrl ? (
            <Image
              src={backImageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="300px"
            />
          ) : (
            <div className="w-full h-full bg-gray-200" />
          )}
        </div>
      </div>
    </div>
  )
}
