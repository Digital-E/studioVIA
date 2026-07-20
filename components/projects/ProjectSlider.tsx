'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Keyboard, Mousewheel, A11y } from 'swiper/modules'
import type { Swiper as SwiperType } from 'swiper'
import 'swiper/css'
import Image from 'next/image'
import { PortableText } from '@portabletext/react'
import type Plyr from 'plyr'
import 'plyr/dist/plyr.css'
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
    if ((e.target as HTMLElement).closest('.plyr')) {
      setSide(null)
      return
    }
    setSide(e.clientX < e.currentTarget.clientWidth / 2 ? 'left' : 'right')
  }, [])

  const handleMouseLeave = useCallback(() => setSide(null), [])

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.plyr')) return
    if (side === 'left') swiperRef.current?.slidePrev()
    else if (side === 'right') swiperRef.current?.slideNext()
  }, [side])

  return (
    <div
      className="fixed inset-0 cursor-none pt-36 pb-32 md:pt-32 md:pb-32"
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
        mousewheel={{ forceToAxis: true, thresholdTime: 0, thresholdDelta: 6 }}
        speed={320}
        loop
        onSwiper={(s) => { swiperRef.current = s }}
        onSlideChange={(s) => {
          s.el.querySelectorAll('video').forEach((video) => video.pause())
        }}
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

  const videoRef = useRef<HTMLVideoElement>(null)
  const videoUrl = slide.video?.asset?.url
  const [videoReady, setVideoReady] = useState(false)

  useEffect(() => {
    const el = videoRef.current
    if (!el || !videoUrl) return
    let cancelled = false
    let player: Plyr | undefined
    const handleCanPlay = () => setVideoReady(true)

    import('plyr').then(({ default: PlyrCtor }) => {
      if (cancelled) return
      // Plyr's setup can reset/reload the media element, so only start
      // watching for a decoded frame once its setup has settled.
      player = new PlyrCtor(el, { controls: ['play','progress', 'mute', 'fullscreen'] })
      if (el.readyState >= 3) {
        setVideoReady(true)
      } else {
        el.addEventListener('canplay', handleCanPlay)
      }
    })

    return () => {
      cancelled = true
      el.removeEventListener('canplay', handleCanPlay)
      player?.destroy()
    }
  }, [videoUrl])

  if (videoUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-white gap-2 px-6 md:px-40">
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          preload="auto"
          className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${videoReady ? 'opacity-100' : 'opacity-0'}`}
        />
        {caption && <p className="font-build text-lg leading-none text-via-black">{caption}</p>}
      </div>
    )
  }

  if (!slide.image) return null

  const imageUrl = urlFor(slide.image).width(1600).url()

  return (
    <div className="w-full h-full flex flex-col bg-white px-6 md:px-40">
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
          <p className="font-build text-lg leading-none text-via-black text-center flex-shrink-0">
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
  const [showTopGradient, setShowTopGradient] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const check = () => {
      setShowGradient(el.scrollHeight > el.clientHeight && el.scrollTop + el.clientHeight < el.scrollHeight - 2)
      setShowTopGradient(el.scrollTop > 2)
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
          <div className="flex flex-col gap-10 w-full py-8 max-w-[900px] md:grid md:gap-4 md:grid-cols-[300px_1fr]">
            {/* Description column */}
            <div className="prose-via order-1 md:order-2">
              {description && (
                <PortableText value={description as Parameters<typeof PortableText>[0]['value']} />
              )}
            </div>

            {/* Credits column */}
            <div className="order-2 md:order-1">
              {slide.credits?.map((credit) => {
                const creditText = locale === 'de' ? credit.text?.de : (credit.text?.en ?? credit.text?.de)
                return (
                  <div key={credit._key} className="border-b border-black pb-0 pt-4 pb-4 first:pt-0">
                    {creditText && (
                      <PortableText
                        value={creditText as Parameters<typeof PortableText>[0]['value']}
                        components={creditComponents as any}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {showTopGradient && (
        <div
          className="absolute top-0 left-0 right-0 h-24 md:hidden pointer-events-none"
          style={{ background: 'linear-gradient(to top, transparent, white)' }}
        />
      )}

      {showGradient && (
        <div
          className="absolute bottom-0 left-0 right-0 h-24 md:hidden pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, white)' }}
        />
      )}
    </div>
  )
}
