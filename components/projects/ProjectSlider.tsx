'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [side, setSide] = useState<'left' | 'right' | null>(null)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setMousePos({ x: e.clientX, y: e.clientY })
    setSide(e.clientX < e.currentTarget.clientWidth / 2 ? 'left' : 'right')
  }, [])

  const handleMouseLeave = useCallback(() => setSide(null), [])

  const handleClick = useCallback(() => {
    if (side === 'left') swiperRef.current?.slidePrev()
    else if (side === 'right') swiperRef.current?.slideNext()
  }, [side])

  return (
    <div
      className="fixed inset-0 cursor-none" style={{ paddingTop: '8rem', paddingBottom: '8rem' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Custom cursor */}
      {side && (
        <div
          className="fixed pointer-events-none z-50 font-build text-3xl leading-none select-none"
          style={{ left: mousePos.x, top: mousePos.y, transform: 'translate(-50%, -50%)' }}
        >
          {side === 'left' ? '<' : '>'}
        </div>
      )}

      <Swiper
        modules={[Keyboard, Mousewheel, A11y]}
        keyboard={{ enabled: true }}
        mousewheel={{ forceToAxis: true, releaseOnEdges: true }}
        loop
        onSwiper={(s) => { swiperRef.current = s }}
        className="w-full h-full"
      >
        {slides.map((slide) => (
          <SwiperSlide key={slide._key}>
            {slide._type === 'mediaSlide' ? (
              <MediaSlide slide={slide} locale={locale} />
            ) : (
              <TextSlide slide={slide} locale={locale} />
            )}
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  )
}

function MediaSlide({ slide, locale }: { slide: Slide; locale: string }) {
  const caption = locale === 'de' ? slide.caption?.de : (slide.caption?.en ?? slide.caption?.de)

  if (slide.slideType === 'video' && slide.videoUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-white gap-2">
        <video
          src={slide.videoUrl}
          controls
          className="max-w-full max-h-full object-contain"
        />
        {caption && <p className="font-build text-lg leading-none text-via-gray">{caption}</p>}
      </div>
    )
  }

  if (!slide.image) return null

  const imageUrl = urlFor(slide.image).width(1600).url()

  return (
    <div className="w-full h-full flex items-center justify-center bg-white px-16">
      <div className="flex flex-col items-center gap-2" style={{ maxHeight: '100%' }}>
        <Image
          src={imageUrl}
          alt=""
          width={1200}
          height={800}
          className="min-h-0 max-w-full w-auto h-auto"
          style={{ maxHeight: caption ? 'calc(100% - 2rem)' : '100%' }}
          priority
          draggable={false}
        />
        {caption && <p className="font-build text-lg leading-none text-via-gray flex-shrink-0">{caption}</p>}
      </div>
    </div>
  )
}

const creditComponents = {
  block: {
    normal: ({ children }: { children?: React.ReactNode }) => (
      <p className="font-build" style={{ fontSize: '1.35rem', lineHeight: 1.15 }}>{children}</p>
    ),
  },
}

function TextSlide({ slide, locale }: { slide: Slide; locale: string }) {
  const description = locale === 'de' ? slide.description?.de : (slide.description?.en ?? slide.description?.de)
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

  return (
    <div className="w-full h-full relative bg-white">
      <div ref={scrollRef} className="w-full h-full overflow-y-auto px-5">
        <div className="min-h-full flex items-center justify-center">
          <div className="grid gap-4 w-full py-8" style={{ gridTemplateColumns: '300px 1fr', maxWidth: '900px' }}>
            {/* Credits column */}
            <div>
              {slide.credits?.map((credit) => (
                <div key={credit._key} className="border-b border-black pb-0 pt-6 first:pt-0">
                  {credit.text && (
                    <PortableText
                      value={credit.text as Parameters<typeof PortableText>[0]['value']}
                      components={creditComponents as any}
                    />
                  )}
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
      </div>

      {showGradient && (
        <div
          className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, white)' }}
        />
      )}
    </div>
  )
}
