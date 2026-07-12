'use client'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { urlFor } from '@/lib/sanity'
import type { Project } from '@/lib/types'

interface ProjectsListProps {
  projects: Project[]
  locale: string
}

export default function ProjectsList({ projects, locale }: ProjectsListProps) {
  const router = useRouter()
  // TEMP dev-only: force scroll for testing, remove before ship
  const displayProjects = [...projects, ...projects, ...projects, ...projects]
    .sort((a, b) => (b.year ?? '').localeCompare(a.year ?? ''))
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

  const yearLabel = locale === 'de' ? 'JAHR' : 'YEAR'
  const nameLabel = locale === 'de' ? 'PROJEKT NAME' : 'PROJECT NAME'
  const locationLabel = locale === 'de' ? 'ORT' : 'LOCATION'

  let lastYear: string | null = null

  return (
    <>
    <div className="pt-[4.5rem] md:pt-20 pb-24 pl-5 pr-5">
      {/* Header */}
      <div className="hidden md:grid md:grid-cols-12 border-b border-black pb-1">
        <div className="col-span-2 font-build text-3xl leading-none text-via-gray">{yearLabel}</div>
        <div className="col-span-5 font-build text-3xl leading-none text-via-gray">{nameLabel}</div>
        <div className="col-span-2 font-build text-3xl leading-none text-via-gray">{locationLabel}</div>
        <div className="col-start-11 col-span-2" />
      </div>

      {/* Rows */}
      {displayProjects.map((project, i) => {
        const yearLabel = project.year ? String(project.year).slice(0, 4) : ''
        const isNewYear = yearLabel !== lastYear
        if (isNewYear) lastYear = yearLabel

        const title = locale === 'de' ? project.title?.de : (project.title?.en ?? project.title?.de)
        const location = locale === 'de' ? project.location?.de : (project.location?.en ?? project.location?.de)
        const prize = locale === 'de' ? project.prize?.de : (project.prize?.en ?? project.prize?.de)

        const thumbnailUrl = project.thumbnail
          ? urlFor(project.thumbnail).width(480).url()
          : null

        const clickable = !!project.slug?.current

        return (
          <div
            key={`${project._id}-${i}`}
            className={`group flex md:grid md:grid-cols-12 border-b border-black items-start min-h-[65px] md:min-h-[160px] ${i === 0 ? 'border-t md:border-t-0' : ''} ${clickable ? 'cursor-pointer' : ''}`}
            onClick={clickable ? () => router.push(`/${locale}/projects/${project.slug.current}`) : undefined}
          >
            <div className="w-14 flex-shrink-0 md:w-auto md:col-span-2 font-build text-[1rem] md:text-3xl leading-none py-[0.35rem] md:py-[0.9rem] group-hover:text-via-gray">{isNewYear ? yearLabel : ''}</div>
            <div className="flex-1 md:col-span-5 font-build text-[1rem] md:text-3xl leading-none pl-4 md:pl-0 pr-4 md:pr-6 py-[0.35rem] md:py-[0.9rem] group-hover:text-via-gray">
              <span className="font-medium">{title}</span>
              {location && <span className="md:hidden"><br />{location}</span>}
              {prize && <><br /><span>{prize}</span></>}
            </div>
            <div className="hidden md:block md:col-span-2 font-build text-3xl leading-none py-[0.9rem] group-hover:text-via-gray">{location}</div>
            <div className="w-24 flex-shrink-0 md:w-auto md:col-start-11 md:col-span-2 py-[2px] self-stretch">
              {thumbnailUrl && (
                <div className="relative w-full h-full">
                  <Image
                    src={thumbnailUrl}
                    alt={title ?? ''}
                    fill
                    className="object-contain"
                    sizes="10vw"
                  />
                </div>
              )}
            </div>
          </div>
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
