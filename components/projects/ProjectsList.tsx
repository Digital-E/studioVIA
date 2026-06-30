'use client'
import Link from 'next/link'
import Image from 'next/image'
import { urlFor } from '@/lib/sanity'
import type { Project } from '@/lib/types'

interface ProjectsListProps {
  projects: Project[]
  locale: string
}

export default function ProjectsList({ projects, locale }: ProjectsListProps) {
  const yearLabel = locale === 'de' ? 'JAHR' : 'YEAR'
  const nameLabel = locale === 'de' ? 'PROJEKT NAME' : 'PROJECT NAME'
  const locationLabel = locale === 'de' ? 'ORT' : 'LOCATION'

  let lastYear: number | null = null

  return (
    <div className="pt-20 pb-24 px-5">
      {/* Header row */}
      <div className="grid items-center border-b border-via-light-gray pb-2 mb-0" style={{ gridTemplateColumns: '80px 1fr 180px 80px' }}>
        <span className="font-build text-xs tracking-widest text-via-gray">{yearLabel}</span>
        <span className="font-build text-xs tracking-widest text-via-gray">{nameLabel}</span>
        <span className="font-build text-xs tracking-widest text-via-gray">{locationLabel}</span>
        <span />
      </div>

      {projects.map((project) => {
        const isNewYear = project.year !== lastYear
        if (isNewYear) lastYear = project.year

        const title = locale === 'de' ? project.title?.de : (project.title?.en ?? project.title?.de)
        const location = locale === 'de' ? project.location?.de : (project.location?.en ?? project.location?.de)
        const prize = locale === 'de' ? project.prize?.de : (project.prize?.en ?? project.prize?.de)

        const thumbnailUrl = project.thumbnail
          ? urlFor(project.thumbnail).width(160).height(110).fit('crop').url()
          : null

        const rowContent = (
          <div
            className={`project-row grid items-center border-b py-3 ${project.isGrayed ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
            style={{ gridTemplateColumns: '80px 1fr 180px 80px' }}
          >
            <span className="font-build text-sm">{isNewYear ? project.year : ''}</span>
            <div className="pr-4">
              <p className={`font-build text-sm ${!project.isGrayed ? 'font-medium' : ''}`}>{title}</p>
              {prize && <p className={`font-build text-sm ${project.isGrayed ? 'text-via-gray' : ''}`}>{prize}</p>}
            </div>
            <span className={`font-build text-sm ${project.isGrayed ? 'text-via-gray' : ''}`}>{location}</span>
            <div className="flex justify-end">
              {thumbnailUrl && (
                <Image
                  src={thumbnailUrl}
                  alt={title ?? ''}
                  width={80}
                  height={55}
                  className="object-cover"
                />
              )}
            </div>
          </div>
        )

        if (project.isGrayed || !project.slug?.current) {
          return <div key={project._id}>{rowContent}</div>
        }

        return (
          <Link key={project._id} href={`/${locale}/projects/${project.slug.current}`}>
            {rowContent}
          </Link>
        )
      })}
    </div>
  )
}
