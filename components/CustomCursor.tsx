'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

// ─── custom hand cursor (site-wide, desktop only) ──────────────────────────
// A crisp SVG hand rendered as a JS-driven overlay, replacing the native
// pointer everywhere at md+ (see the `body *` cursor:none rule in
// globals.css). Native `cursor: url()` images cap out at a small, blurry
// raster size, not sharp enough at the size these need to read at.
const CURSOR_SCALE = 1.12
export type CursorMode = 'idle' | 'grab' | 'link'
// hotspotXPct/hotspotYPct locate each icon's own "business end" — the
// fingertip for idle/link, the centered fist for grab — as a fraction of
// its own bounding box. The overlay is positioned at the real mouse
// coordinates via translate3d, then each image is shifted by
// -hotspotX%/-hotspotY% of itself so that exact point lands on the real
// pointer instead of the image's bounding-box center: without this, the
// visible tip of the hand can sit several pixels away from where hover/
// click actually registers (which always tracks the real system cursor,
// unaffected by how this overlay is drawn), which is what reads as
// "imprecise" when aiming at a link.
const CURSOR_ICONS: Record<CursorMode, { src: string; w: number; h: number; hotspotXPct: number; hotspotYPct: number }> = {
  idle: { src: '/cursors/hand1.svg', w: 19.37 * CURSOR_SCALE, h: 21.79 * CURSOR_SCALE, hotspotXPct: 0.38, hotspotYPct: 0 },
  grab: { src: '/cursors/hand2.svg', w: 18.76 * CURSOR_SCALE, h: 14.37 * CURSOR_SCALE, hotspotXPct: 0.50, hotspotYPct: 0 },
  link: { src: '/cursors/hand3.svg', w: 18.76 * CURSOR_SCALE, h: 21.79 * CURSOR_SCALE, hotspotXPct: 0.27, hotspotYPct: 0 },
}

// Module-level (survives a component remount, e.g. locale switch, so a
// fresh mount can restore the cursor immediately instead of leaving it
// frozen at the top-left default until the next real mouse move) snapshot
// of the cursor's last known state.
export let lastKnownCursor = { x: 0, y: 0, mode: 'idle' as CursorMode, shown: false }

// Lets a caller (InfiniteCanvas's canvas-pan drag) force 'grab' mode and
// suspend the usual hover-driven idle/link detection while dragging, since
// this component's own global mousemove listener otherwise has no idea a
// drag is in progress.
let dragSuspended = false
type ModeListener = (mode: CursorMode) => void
const modeListeners = new Set<ModeListener>()

function broadcastMode(mode: CursorMode) {
  lastKnownCursor.mode = mode
  modeListeners.forEach((l) => l(mode))
}

export function setCursorDragging(dragging: boolean) {
  dragSuspended = dragging
  if (dragging) broadcastMode('grab')
}

// Lets a caller (the project slider's own "<"/">" cursor) hide this overlay
// entirely while it's showing its own custom cursor in the same spot —
// this overlay is a fixed, always-on-top layer that otherwise has no idea
// something else on the page is drawing its own cursor over it.
let forceHidden = false
type VisibilityListener = (hidden: boolean) => void
const visibilityListeners = new Set<VisibilityListener>()

export function setCursorForceHidden(hidden: boolean) {
  forceHidden = hidden
  visibilityListeners.forEach((l) => l(hidden))
}

// Re-derives idle-vs-link from whatever's actually under a given point —
// used after a drag ends, since mousemove doesn't fire on mouseup.
export function recomputeCursorModeAt(x: number, y: number) {
  const el = document.elementFromPoint(x, y)
  broadcastMode(el?.closest('a') ? 'link' : 'idle')
}

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)
  const [cursorMode, setCursorMode] = useState<CursorMode>(() => lastKnownCursor.mode)
  const [cursorShown, setCursorShown] = useState(() => lastKnownCursor.shown)
  const [cursorForceHidden, setCursorForceHiddenState] = useState(() => forceHidden)

  // Moves the cursor straight via the DOM, not React state — mousemove
  // fires far more often than a render budget allows.
  const updateCursorPos = useCallback((x: number, y: number) => {
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate3d(${x}px,${y}px,0)`
    }
  }, [])

  // Paints the cursor at its last known position before the first frame —
  // a *layout* effect, not a regular one, so a remount never flashes it at
  // the top-left default transform first.
  useLayoutEffect(() => {
    updateCursorPos(lastKnownCursor.x, lastKnownCursor.y)
  }, [updateCursorPos])

  // Hiding the native pointer (globals.css) is scoped to this class, not
  // applied unconditionally site-wide — this component only mounts on the
  // public site (see app/[locale]/layout.tsx), not on the Sanity Studio
  // backend at /studio, which would otherwise be left with no visible
  // cursor at all once the native one is hidden.
  useLayoutEffect(() => {
    document.body.classList.add('custom-cursor-active')
    return () => { document.body.classList.remove('custom-cursor-active') }
  }, [])

  useEffect(() => {
    const listener: ModeListener = (mode) => setCursorMode(mode)
    modeListeners.add(listener)
    return () => { modeListeners.delete(listener) }
  }, [])

  useEffect(() => {
    const listener: VisibilityListener = (hidden) => setCursorForceHiddenState(hidden)
    visibilityListeners.add(listener)
    return () => { visibilityListeners.delete(listener) }
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      lastKnownCursor.x = e.clientX
      lastKnownCursor.y = e.clientY
      lastKnownCursor.shown = true
      updateCursorPos(e.clientX, e.clientY)
      setCursorShown(true)
      if (!dragSuspended) {
        const mode = (e.target as HTMLElement).closest('a') ? 'link' : 'idle'
        setCursorMode(mode)
        lastKnownCursor.mode = mode
      }
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [updateCursorPos])

  // Shows/hides the cursor overlay based on the pointer actually being over
  // the browser viewport at all.
  useEffect(() => {
    const onEnter = (e: MouseEvent) => {
      lastKnownCursor.x = e.clientX
      lastKnownCursor.y = e.clientY
      lastKnownCursor.shown = true
      updateCursorPos(e.clientX, e.clientY)
      setCursorShown(true)
    }
    const onLeave = () => {
      lastKnownCursor.shown = false
      setCursorShown(false)
    }
    document.addEventListener('mouseenter', onEnter)
    document.addEventListener('mouseleave', onLeave)
    return () => {
      document.removeEventListener('mouseenter', onEnter)
      document.removeEventListener('mouseleave', onLeave)
    }
  }, [updateCursorPos])

  return (
    <div
      ref={cursorRef}
      className="hidden md:block fixed left-0 top-0 pointer-events-none z-[9999]"
      style={{ opacity: cursorShown && !cursorForceHidden ? 1 : 0 }}
    >
      <img
        src={CURSOR_ICONS[cursorMode].src}
        alt=""
        draggable={false}
        width={CURSOR_ICONS[cursorMode].w}
        height={CURSOR_ICONS[cursorMode].h}
        style={{
          display: 'block',
          transform: `translate(-${CURSOR_ICONS[cursorMode].hotspotXPct * 100}%, -${CURSOR_ICONS[cursorMode].hotspotYPct * 100}%)`,
        }}
      />
    </div>
  )
}
