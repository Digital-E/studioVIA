'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavigationProps {
  locale: string
  activePage: 'projects' | 'studio' | null
}

export default function Navigation({ locale, activePage }: NavigationProps) {
  const pathname = usePathname()

  const projectsHref = `/${locale}/projects`
  const studioHref = `/${locale}/studio`
  const homeHref = `/${locale}`

  const deHref = pathname.replace(`/${locale}`, '/de')
  const enHref = pathname.replace(`/${locale}`, '/en')

  return (
    <>
      {/* Top bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-start justify-between p-5 pointer-events-none">
        <Link href={homeHref} className="font-build text-3xl tracking-tight pointer-events-auto">
          VIA
        </Link>
        <div className="flex gap-5 font-build text-xl pointer-events-auto">
          <Link href={deHref} className={locale === 'de' ? 'underline underline-offset-2' : ''}>
            DE
          </Link>
          <Link href={enHref} className={locale === 'en' ? 'underline underline-offset-2' : ''}>
            EN
          </Link>
        </div>
      </nav>

      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-end justify-between p-5 pointer-events-none">
        <Link
          href={projectsHref}
          className={`font-build text-3xl pointer-events-auto ${activePage === 'projects' ? 'nav-link-active' : ''}`}
        >
          {locale === 'de' ? 'Projekte' : 'Projects'}
        </Link>
        <Link
          href={studioHref}
          className={`font-build text-3xl pointer-events-auto ${activePage === 'studio' ? 'nav-link-active' : ''}`}
        >
          Studio
        </Link>
      </nav>
    </>
  )
}
