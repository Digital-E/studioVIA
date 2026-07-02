import { draftMode } from 'next/headers'
import { getClient } from '@/lib/sanity'
import { studioPageQuery } from '@/lib/queries'
import type { StudioPageData } from '@/lib/types'
import StudioContent from '@/components/studio/StudioContent'
import Navigation from '@/components/Navigation'

export default async function StudioPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const { isEnabled: preview } = await draftMode()
  const data: StudioPageData = (await getClient(preview).fetch(studioPageQuery)) ?? {}

  return (
    <main className="w-screen h-screen overflow-hidden bg-white">
      <Navigation locale={locale} activePage="studio" />
      <StudioContent data={data} locale={locale} />
    </main>
  )
}
