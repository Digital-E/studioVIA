import { draftMode } from 'next/headers'
import { getClient } from '@/lib/sanity'
import { allProjectsPageQuery } from '@/lib/queries'
import type { AllProjectsPageData } from '@/lib/types'
import ProjectsList from '@/components/projects/ProjectsList'
import Navigation from '@/components/Navigation'

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const { isEnabled: preview } = await draftMode()
  const data: AllProjectsPageData = (await getClient(preview).fetch(allProjectsPageQuery)) ?? {}

  return (
    <main className="min-h-screen">
      <Navigation locale={locale} activePage="projects" />
      <ProjectsList years={data.years ?? []} locale={locale} />
    </main>
  )
}
