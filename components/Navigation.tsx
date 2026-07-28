'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { HOME_TILES_REVEAL_TOTAL_MS, hasRevealedThisSession } from './homepage/InfiniteCanvas'

interface NavigationProps {
  locale: string
  activePage: 'projects' | 'studio' | null
  isHome?: boolean
  topGradient?: boolean
  bottomGradient?: boolean
}

export default function Navigation({ locale, activePage, isHome = false, topGradient = true, bottomGradient = false }: NavigationProps) {
  const pathname = usePathname()

  // On the homepage, the nav bars fade in only once the canvas's own tile
  // reveal has finished — everywhere else there's no reveal to sequence
  // after, so they render at full opacity immediately.
  const [navRevealed, setNavRevealed] = useState(!isHome)
  // Captured once, in a layout effect, rather than re-checked later in the
  // regular effect below — InfiniteCanvas's own layout effect marks the
  // session as revealed before paint too, and (because Navigation mounts
  // first in the tree) that write happens *after* this layout effect but
  // *before* any regular effects fire. Re-querying sessionStorage from the
  // regular effect would therefore always see "already revealed", even on
  // a genuine first visit, and skip scheduling the reveal entirely.
  const wasAlreadyRevealed = useRef(false)
  useLayoutEffect(() => {
    if (!isHome) return
    wasAlreadyRevealed.current = hasRevealedThisSession()
    if (wasAlreadyRevealed.current) setNavRevealed(true)
  }, [isHome])
  useEffect(() => {
    if (!isHome || wasAlreadyRevealed.current) return
    const t = setTimeout(() => setNavRevealed(true), HOME_TILES_REVEAL_TOTAL_MS)
    return () => clearTimeout(t)
  }, [isHome])
  const navRevealStyle = isHome
    ? { opacity: navRevealed ? 1 : 0, transition: 'opacity 0.6s ease' }
    : undefined

  const projectsHref = `/${locale}/projects`
  const studioHref = `/${locale}/studio`
  const homeHref = `/${locale}`

  const deHref = pathname.replace(`/${locale}`, '/de')
  const enHref = pathname.replace(`/${locale}`, '/en')

  const blend = isHome ? 'text-black' : ''
  // On the homepage, InfiniteCanvas renders a custom hand cursor that
  // replaces the native one over the canvas — nav links need the same
  // treatment, or the native pointer cursor reappears the moment the mouse
  // crosses onto a nav link. Other pages have no custom cursor to swap in,
  // so they keep the native pointer.
  const homeCursor = isHome ? 'md:cursor-none' : ''

  return (
    <>
      {!isHome && topGradient && (
        <div className="fixed top-0 left-0 right-0 h-20 bg-gradient-to-b from-white from-80% to-transparent pointer-events-none z-40" />
      )}

      {bottomGradient && (
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white from-80% to-transparent pointer-events-none z-40" />
      )}

      {/* Top bar */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-start justify-between p-5 pointer-events-none"
        style={navRevealStyle}
      >
        <Link href={homeHref} className={`font-build text-3xl md:text-4xl tracking-tight pointer-events-auto ${blend} ${homeCursor}`}>
          VIA
        </Link>
        <div className={`flex gap-5 font-build text-xl md:text-2xl pointer-events-auto ${blend} ${homeCursor}`}>
          <Link href={deHref} className={`${homeCursor} ${locale === 'de' ? 'underline underline-offset-2' : ''}`}>
            DE
          </Link>
          <Link href={enHref} className={`${homeCursor} ${locale === 'en' ? 'underline underline-offset-2' : ''}`}>
            EN
          </Link>
        </div>
      </nav>

      {/* Bottom bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-end justify-between p-5 pointer-events-none"
        style={navRevealStyle}
      >
        <Link
          href={projectsHref}
          className={`font-build text-3xl md:text-4xl pointer-events-auto ${blend} ${homeCursor} ${activePage === 'projects' ? 'nav-link-active' : ''}`}
        >
          {locale === 'de' ? 'Projekte' : 'Projects'}
        </Link>
        <Link
          href={studioHref}
          className={`font-build text-3xl md:text-4xl pointer-events-auto ${blend} ${homeCursor} ${activePage === 'studio' ? 'nav-link-active' : ''}`}
        >
          Studio
        </Link>
      </nav>
    </>
  )
}
