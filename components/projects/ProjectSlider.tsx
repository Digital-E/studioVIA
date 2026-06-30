'use client'
import { useRef, useState, useCallback } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Keyboard, Mousewheel, A11y } from 'swiper/modules'
import type { Swiper as SwiperType } from 'swiper'
import 'swiper/css'
import Image from 'next/image'
import { PortableText } from '@portabletext/react'
import { urlFor } from '@/lib/sanity'
import type { Slide } from '@/lib/types'

interface ProjectSliderProps {
  slides: Slide[]
  locale: string
}

export default function ProjectSlider({ slides, locale }: ProjectSliderProps) {
  const swiperRef = useRef<SwiperType | null>(null)
  const [hoveredSide, setHoveredSide] = useState<'left' | 'right' | null>(null)
  const [isBeginning, setIsBeginning] = useState(true)
  const [isEnd, setIsEnd] = useState(slides.length <= 1)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const mid = e.currentTarget.clientWidth / 2
    setHoveredSide(e.clientX < mid ? 'left' : 'right')
  }, [])

  const handleMouseLeave = useCallback(() => setHoveredSide(null), [])

  return (
    <div
      className="fixed inset-0 pt-14"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Left arrow */}
      {hoveredSide === 'left' && !isBeginning && (
        <button
          className="fixed left-5 top-1/2 z-30 -translate-y-1/2 font-build text-lg select-none"
          onClick={() => swiperRef.current?.slidePrev()}
          aria-label="Previous"
        >
          {'<'}
        </button>
      )}

      {/* Right arrow */}
      {hoveredSide === 'right' && !isEnd && (
        <button
          className="fixed right-5 top-1/2 z-30 -translate-y-1/2 font-build text-lg select-none"
          onClick={() => swiperRef.current?.slideNext()}
          aria-label="Next"
        >
          {'>'}
        </button>
      )}

      <Swiper
        modules={[Keyboard, Mousewheel, A11y]}
        keyboard={{ enabled: true }}
        mousewheel={{ forceToAxis: true, releaseOnEdges: true }}
        grabCursor
        onSwiper={(s) => { swiperRef.current = s }}
        onSlideChange={(s) => {
          setIsBeginning(s.isBeginning)
          setIsEnd(s.isEnd)
        }}
        className="w-full h-full"
      >
        {slides.map((slide) => (
          <SwiperSlide key={slide._key}>
            {slide._type === 'mediaSlide' ? (
              <MediaSlide slide={slide} />
            ) : (
              <TextSlide slide={slide} locale={locale} />
            )}
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  )
}

function MediaSlide({ slide }: { slide: Slide }) {
  if (slide.slideType === 'video' && slide.videoUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white">
        <video
          src={slide.videoUrl}
          controls
          className="max-w-full max-h-full object-contain"
          style={{ maxHeight: 'calc(100vh - 56px)' }}
        />
      </div>
    )
  }

  if (!slide.image) return null

  const imageUrl = urlFor(slide.image).width(1600).url()

  return (
    <div className="w-full h-full flex items-center justify-center bg-white px-16">
      <div className="relative" style={{ maxHeight: 'calc(100vh - 56px)', maxWidth: '100%' }}>
        <Image
          src={imageUrl}
          alt=""
          width={1200}
          height={800}
          className="object-contain max-h-[calc(100vh-56px)] w-auto"
          priority
          draggable={false}
        />
      </div>
    </div>
  )
}

function TextSlide({ slide, locale }: { slide: Slide; locale: string }) {
  const description = locale === 'de' ? slide.description?.de : (slide.description?.en ?? slide.description?.de)

  return (
    <div className="w-full h-full flex items-center justify-center bg-white px-5">
      <div className="grid gap-16 w-full max-w-5xl" style={{ gridTemplateColumns: '260px 1fr' }}>
        {/* Credits column */}
        <div className="space-y-0">
          {slide.credits?.map((credit) => (
            <div key={credit._key} className="border-b border-via-light-gray py-3">
              <p className="font-build text-xs text-via-gray leading-tight">{credit.label}:</p>
              <p className="font-build text-sm leading-tight mt-0.5">{credit.value}</p>
            </div>
          ))}
        </div>

        {/* Description column */}
        <div className="prose-via">
          {description && (
            <PortableText value={description as Parameters<typeof PortableText>[0]['value']} />
          )}
        </div>
      </div>
    </div>
  )
}
