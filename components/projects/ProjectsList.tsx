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
    <div className="pt-16 pb-24 pl-5">
      {/* Header */}
      <div className="grid grid-cols-12 border-b border-black pb-1">
        <div className="col-span-2 font-build text-3xl leading-none text-via-gray">{yearLabel}</div>
        <div className="col-span-6 font-build text-3xl leading-none text-via-gray">{nameLabel}</div>
        <div className="col-span-3 font-build text-3xl leading-none text-via-gray">{locationLabel}</div>
        <div className="col-span-1" />
      </div>

      {/* Rows */}
      {projects.map((project) => {
        const yearLabel = project.year ? String(project.year).slice(0, 4) : ''
        const isNewYear = yearLabel !== lastYear
        if (isNewYear) lastYear = yearLabel

        const title = locale === 'de' ? project.title?.de : (project.title?.en ?? project.title?.de)
        const location = locale === 'de' ? project.location?.de : (project.location?.en ?? project.location?.de)
        const prize = locale === 'de' ? project.prize?.de : (project.prize?.en ?? project.prize?.de)

        const thumbnailUrl = project.thumbnail
          ? urlFor(project.thumbnail).width(160).height(110).fit('crop').url()
          : null

        const clickable = !!project.slug?.current

        return (
          <div
            key={project._id}
            className={`group grid grid-cols-12 border-b border-black items-start ${clickable ? 'cursor-pointer' : ''}`}
            onClick={clickable ? () => router.push(`/${locale}/projects/${project.slug.current}`) : undefined}
          >
            <div className="col-span-2 font-build text-3xl leading-none py-[0.9rem] group-hover:text-via-gray">{isNewYear ? yearLabel : ''}</div>
            <div className="col-span-6 font-build text-3xl leading-none pr-6 py-[0.9rem] group-hover:text-via-gray">
              <span className="font-medium">{title}</span>
              {prize && <><br /><span>{prize}</span></>}
            </div>
            <div className="col-span-3 font-build text-3xl leading-none py-[0.9rem] group-hover:text-via-gray">{location}</div>
            <div className="col-start-12 col-span-1 py-[2px]" style={{ position: 'relative', width: '125%', left: '-25%' }}>
              {thumbnailUrl && (
                <div className="relative aspect-[1.5/1]">
                  <Image
                    src={thumbnailUrl}
                    alt={title ?? ''}
                    fill
                    className="object-cover"
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
