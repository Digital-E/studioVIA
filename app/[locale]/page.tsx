import { draftMode } from 'next/headers'
import { getClient } from '@/lib/sanity'
import { homepageQuery } from '@/lib/queries'
import type { HomepageData } from '@/lib/types'
import InfiniteCanvas from '@/components/homepage/InfiniteCanvas'
import Navigation from '@/components/Navigation'

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const { isEnabled: preview } = await draftMode()
  const data: HomepageData = (await getClient(preview).fetch(homepageQuery)) ?? {}

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      <Navigation locale={locale} activePage={null} isHome />
      <InfiniteCanvas
        items={data.canvasItems ?? []}
        centerText={data.centerText}
        locale={locale}
      />
    </main>
  )
}
