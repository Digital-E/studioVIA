'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { PortableText } from '@portabletext/react'
import type { PortableTextComponents } from '@portabletext/react'
import { urlFor } from '@/lib/sanity'
import type { StudioPageData } from '@/lib/types'

interface StudioContentProps {
  data: StudioPageData
  locale: string
}

const richTextComponents: PortableTextComponents = {
  hardBreak: () => <br />,
}

export default function StudioContent({ data, locale }: StudioContentProps) {
  const leftColumn = locale === 'de' ? data.leftColumn?.de : (data.leftColumn?.en ?? data.leftColumn?.de)
  const rightColumn = locale === 'de' ? data.rightColumn?.de : (data.rightColumn?.en ?? data.rightColumn?.de)
  const photoUrl = data.photo ? urlFor(data.photo).width(900).url() : null

  const scrollRef = useRef<HTMLDivElement>(null)
  const [showGradient, setShowGradient] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const check = () => {
      setShowGradient(el.scrollHeight > el.clientHeight && el.scrollTop + el.clientHeight < el.scrollHeight - 2)
    }
    check()
    el.addEventListener('scroll', check)
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', check); ro.disconnect() }
  }, [])

  // Mobile stacks everything into one scrolling column (see mobileScrollRef
  // block below), so it needs its own scroll/gradient tracking independent
  // of the desktop two-pane layout above.
  const mobileScrollRef = useRef<HTMLDivElement>(null)
  const [mobileShowGradient, setMobileShowGradient] = useState(false)

  useEffect(() => {
    const el = mobileScrollRef.current
    if (!el) return
    const check = () => {
      setMobileShowGradient(el.scrollHeight > el.clientHeight && el.scrollTop + el.clientHeight < el.scrollHeight - 2)
    }
    check()
    el.addEventListener('scroll', check)
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', check); ro.disconnect() }
  }, [])

  // Reserve space at the very bottom of the viewport for the fixed nav bar
  // so neither column ever renders content underneath it.
  const NAV_CLEARANCE = '4rem'

  return (
    <>
      {/* Mobile: everything stacks into one scrolling column */}
      <div className="md:hidden relative w-full h-full">
        <div ref={mobileScrollRef} className="studio-page w-full h-full overflow-y-auto pt-44 pb-24 px-5">
          <div className="prose-via">
            {leftColumn && (
              <PortableText value={leftColumn as Parameters<typeof PortableText>[0]['value']} components={richTextComponents} />
            )}
          </div>

          <div className="prose-via mt-14">
            {rightColumn && (
              <PortableText value={rightColumn as Parameters<typeof PortableText>[0]['value']} components={richTextComponents} />
            )}
          </div>

          {photoUrl && (
            <div className="relative w-full aspect-[4/3] mt-8">
              <Image
                src={photoUrl}
                alt="Studio VIA team"
                fill
                className="object-cover"
                sizes="100vw"
              />
            </div>
          )}
        </div>

        {mobileShowGradient && (
          <div
            className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent, white)' }}
          />
        )}
      </div>

      {/* Desktop: two-pane layout with the photo fixed alongside the text */}
      <div className="relative w-full h-full hidden md:flex" style={{ gap: '2rem', paddingBottom: NAV_CLEARANCE }}>
        {/* Text area: the only part that scrolls */}
        <div className="relative h-full" style={{ flex: '1 1 0%' }}>
          <div ref={scrollRef} className="studio-page scrollbar-hide w-full h-full overflow-y-auto pt-44 pb-8 pl-5">
            <div className="grid gap-8" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {/* Left column */}
              <div className="prose-via" style={{ paddingRight: '1.5rem' }}>
                {leftColumn && (
                  <PortableText value={leftColumn as Parameters<typeof PortableText>[0]['value']} components={richTextComponents} />
                )}
              </div>

              {/* Middle column */}
              <div className="prose-via" style={{ paddingRight: '1.5rem' }}>
                {rightColumn && (
                  <PortableText value={rightColumn as Parameters<typeof PortableText>[0]['value']} components={richTextComponents} />
                )}
              </div>
            </div>
          </div>

          {showGradient && (
            <div
              className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
              style={{ background: 'linear-gradient(to bottom, transparent, white)' }}
            />
          )}
        </div>

        {/* Photo: fixed in place, fills the available viewport height above the nav */}
        <div className="flex flex-col h-full" style={{ flex: '1 1 0%', paddingRight: '1.25rem' }}>
          <div style={{ height: '11rem', flexShrink: 0 }} />
          <div className="relative flex-1 z-[999]">
            {photoUrl && (
              <Image
                src={photoUrl}
                alt="Studio VIA team"
                fill
                className="object-cover"
                sizes="50vw"
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
