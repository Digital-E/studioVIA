import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import { getClient } from '@/lib/sanity'
import { projectQuery, projectsListQuery } from '@/lib/queries'
import type { Project } from '@/lib/types'
import ProjectSlider from '@/components/projects/ProjectSlider'
import Navigation from '@/components/Navigation'

export async function generateStaticParams() {
  const projects: Project[] = await getClient().fetch(projectsListQuery)
  return projects
    .filter((p) => p.slug?.current)
    .map((p) => ({ slug: p.slug.current }))
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const { isEnabled: preview } = await draftMode()
  const project: Project | null = await getClient(preview).fetch(projectQuery, { slug })

  if (!project) notFound()

  const title = locale === 'de' ? project.title.de : (project.title.fr ?? project.title.de)

  return (
    <main className="w-screen h-screen overflow-hidden bg-white">
      <Navigation locale={locale} activePage="projects" topGradient={false} />
      <div className="fixed top-0 left-0 right-0 z-[45] flex items-start justify-center pt-[5rem] md:pt-[1.35rem] pointer-events-none">
        <h1 className="text-3xl leading-none max-w-[80%] font-build text-center md:max-w-md">{title}</h1>
      </div>
      <ProjectSlider slides={project.slides ?? []} locale={locale} />
    </main>
  )
}
