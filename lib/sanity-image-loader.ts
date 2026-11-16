import type { ImageLoaderProps } from 'next/image'

export default function sanityImageLoader({ src, width, quality }: ImageLoaderProps): string {
  const url = new URL(src)
  if (url.hostname !== 'cdn.sanity.io') {
    throw new Error(`Unsupported image host for Sanity image loader: ${url.hostname}`)
  }

  url.searchParams.set('w', String(width))
  url.searchParams.set('auto', 'format')
  if (quality) url.searchParams.set('q', String(quality))

  return url.toString()
}
