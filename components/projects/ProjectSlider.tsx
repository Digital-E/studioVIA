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

const CAPTION_OFFSET = 26 // gap-2 (8px) + text-lg leading-none (~18px)

function MediaSlide({ slide, locale }: { slide: Slide; locale: string }) {
  const caption = locale === 'de' ? slide.caption?.de : (slide.caption?.en ?? slide.caption?.de)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const imageARRef = useRef<number | null>(null)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)

  const [ready, setReady] = useState(false)
  const rafRef = useRef<number | null>(null)

  const computeSize = useCallback(() => {
    const el = wrapperRef.current
    const ar = imageARRef.current
    if (!el || !ar) return
    const availW = el.clientWidth
    const availH = el.clientHeight - (caption ? CAPTION_OFFSET : 0)
    const newSize = availW / availH > ar
      ? { w: Math.round(availH * ar), h: availH }
      : { w: availW, h: Math.round(availW / ar) }
    setImgSize(newSize)
    // Let the size paint first, then fade in
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => setReady(true))
  }, [caption])

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(computeSize)
    ro.observe(el)
    return () => {
      ro.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [computeSize])

  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    // naturalWidth/naturalHeight reflect the CDN-served image after crop is applied
    imageARRef.current = img.naturalWidth / img.naturalHeight
    computeSize()
  }, [computeSize])

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
    <div className="w-full h-full flex flex-col bg-white px-40">
      <div ref={wrapperRef} className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2">
        <Image
          src={imageUrl}
          alt=""
          width={imgSize?.w ?? 1600}
          height={imgSize?.h ?? 900}
          className={`flex-shrink-0 transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}
          style={!imgSize ? { maxWidth: '100%', height: 'auto' } : undefined}
          onLoad={handleLoad}
          priority
          draggable={false}
        />
        {caption && (
          <p className="font-build text-lg leading-none text-via-gray text-center flex-shrink-0">
            {caption}
          </p>
        )}
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
