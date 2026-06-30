import { draftMode } from 'next/headers'
import { getClient } from '@/lib/sanity'
import { projectsListQuery } from '@/lib/queries'
import type { Project } from '@/lib/types'
import ProjectsList from '@/components/projects/ProjectsList'
import Navigation from '@/components/Navigation'

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const { isEnabled: preview } = await draftMode()
  const projects: Project[] = (await getClient(preview).fetch(projectsListQuery)) ?? []

  return (
    <main className="min-h-screen">
      <Navigation locale={locale} activePage="projects" />
      <ProjectsList projects={projects} locale={locale} />
    </main>
  )
}
