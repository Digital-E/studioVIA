'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { urlFor } from '@/lib/sanity'
import type { AllProjectsYearGroup } from '@/lib/types'
import { useVideoBlobSrc } from '@/components/homepage/useVideoBlobSrc'

interface ProjectsListProps {
  years: AllProjectsYearGroup[]
  locale: string
}

function RowLink({ href, className, children }: { href: string | null; className: string; children: React.ReactNode }) {
  if (href) return <Link href={href} className={className}>{children}</Link>
  return <div className={className}>{children}</div>
}

function ThumbnailVideo({ src }: { src: string }) {
  const { ref, blobUrl } = useVideoBlobSrc(src)
  const [loaded, setLoaded] = useState(false)
  return (
    <video
      ref={ref}
      src={blobUrl ?? undefined}
      autoPlay
      loop
      muted
      playsInline
      onLoadedData={() => setLoaded(true)}
      className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
    />
  )
}

export default function ProjectsList({ years, locale }: ProjectsListProps) {
  const rows = years.flatMap((group) =>
    (group.projects ?? [])
      .filter((project): project is NonNullable<typeof project> => project != null)
      .map((project, idx) => ({
        project,
        year: group.year ?? '',
        isNewYear: idx === 0,
      }))
  )
  const [showGradient, setShowGradient] = useState(false)

  useEffect(() => {
    const check = () => {
      const overflows = document.body.scrollHeight > window.innerHeight
      const atBottom = window.scrollY + window.innerHeight >= document.body.scrollHeight - 2
      setShowGradient(overflows && !atBottom)
    }
    check()
    window.addEventListener('scroll', check)
    window.addEventListener('resize', check)
    return () => {
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [])

  const yearColumnLabel = locale === 'de' ? 'JAHR' : 'ANNÉE'
  const nameLabel = locale === 'de' ? 'PROJEKT NAME' : 'PROJET'
  const locationLabel = locale === 'de' ? 'ORT' : 'LIEU'

  return (
    <>
    <div className="pt-[4.5rem] md:pt-20 pb-24 pl-5 pr-5">
      {/* Header */}
      <div className="hidden md:grid md:grid-cols-12 border-b border-black pb-1">
        <div className="col-span-2 font-build text-3xl leading-none">{yearColumnLabel}</div>
        <div className="col-span-5 font-build text-3xl leading-none">{nameLabel}</div>
        <div className="col-span-2 font-build text-3xl leading-none">{locationLabel}</div>
        <div className="col-start-11 col-span-2" />
      </div>

      {/* Rows */}
      {rows.map(({ project, year, isNewYear }, i) => {
        const title = locale === 'de' ? project.title?.de : (project.title?.fr ?? project.title?.de)
        const location = locale === 'de' ? project.location?.de : (project.location?.fr ?? project.location?.de)
        const information1 = locale === 'de' ? project.information1?.de : (project.information1?.fr ?? project.information1?.de)
        const information2 = locale === 'de' ? project.information2?.de : (project.information2?.fr ?? project.information2?.de)
        const information3 = locale === 'de' ? project.information3?.de : (project.information3?.fr ?? project.information3?.de)

        const thumbnailVideoUrl = project.thumbnailVideo?.asset?.url
        const thumbnailUrl = project.thumbnail
          ? urlFor(project.thumbnail).width(480).url()
          : null

        const href = project.slug?.current ? `/${locale}/projects/${project.slug.current}` : null
        const rowClassName = `group flex md:grid md:grid-cols-12 border-b border-black items-start min-h-[65px] md:min-h-[160px] ${i === 0 ? 'border-t md:border-t-0' : ''} ${href ? 'cursor-pointer' : ''}`

        return (
          <RowLink
            key={`${project._id}-${i}`}
            href={href}
            className={rowClassName}
          >
            <div className="w-14 flex-shrink-0 md:w-auto md:col-span-2 font-build text-[1rem] md:text-3xl leading-none py-[0.35rem] md:py-[0.9rem]">{isNewYear ? year : ''}</div>
            <div className="flex-1 md:col-span-5 font-build text-[1rem] md:text-3xl leading-none pl-4 md:pl-0 pr-4 md:pr-6 py-[0.35rem] md:py-[0.9rem] group-hover:text-via-gray">
              <span className="font-medium">{title}</span>
              {location && <span className="md:hidden"><br />{location}</span>}
              {information1 && <><br /><span>{information1}</span></>}
              {information2 && <><br /><span>{information2}</span></>}
              {information3 && <><br /><span>{information3}</span></>}
            </div>
            <div className="hidden md:block md:col-span-2 font-build text-3xl leading-none py-[0.9rem] group-hover:text-via-gray">{location}</div>
            <div className="w-24 flex-shrink-0 md:w-auto md:col-start-11 md:col-span-2 py-[2px] self-stretch">
              {thumbnailVideoUrl ? (
                <div className="relative w-full h-full">
                  <ThumbnailVideo src={thumbnailVideoUrl} />
                </div>
              ) : thumbnailUrl ? (
                <div className="relative w-full h-full">
                  <Image
                    src={thumbnailUrl}
                    alt={title ?? ''}
                    fill
                    className="object-contain"
                    sizes="10vw"
                  />
                </div>
              ) : null}
            </div>
          </RowLink>
        )
      })}
    </div>

    {showGradient && (
      <div
        className="fixed bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, white)' }}
      />
    )}
    </>
  )
}
