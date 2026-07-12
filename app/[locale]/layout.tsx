import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { draftMode } from 'next/headers'
import { VisualEditing } from 'next-sanity'
import LocaleHtml from '@/components/LocaleHtml'
import DraftModeBanner from '@/components/DraftModeBanner'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!(routing.locales as readonly string[]).includes(locale)) notFound()

  const messages = await getMessages()
  const { isEnabled: isDraft } = await draftMode()

  return (
    <NextIntlClientProvider messages={messages}>
      <LocaleHtml locale={locale} />
      {children}
      {isDraft && <VisualEditing />}
      {isDraft && <DraftModeBanner />}
    </NextIntlClientProvider>
  )
}
