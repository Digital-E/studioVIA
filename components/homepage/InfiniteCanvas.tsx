'use client'
import { useRef, useState, useCallback, useMemo, useEffect, Fragment } from 'react'
import type { CanvasItem as CanvasItemType, LocalizedString } from '@/lib/types'
import CanvasItem from './CanvasItem'

// ─── layout constants ─────────────────────────────────────────────────────────

const TILE_W      = 2800
const TILE_H      = 1900
const EDGE_MARGIN = 180
const DEFAULT_W   = 360
const N_VARIANTS  = 4

// ─── physics ──────────────────────────────────────────────────────────────────

const LERP     = 0.08   // fraction of gap closed per frame for wheel/trackpad
const FRICTION = 0.96   // velocity decay per frame for drag-fling
const MIN_V    = 0.2    // px/frame threshold to stop fling

// ─── seeded random (FNV-1a 32-bit) ───────────────────────────────────────────

function rand(key: string, n: number): number {
  let h = 2166136261 >>> 0
  const s = key + '\x00' + n
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h  = Math.imul(h, 16777619) >>> 0
  }
  return (h >>> 0) / 0xffffffff
}

// ─── variant assignment per tile ──────────────────────────────────────────────

function tileVariant(tx: number, ty: number): number {
  let h = 2166136261 >>> 0
  const bytes = [tx & 0xff, (tx >> 8) & 0xff, ty & 0xff, (ty >> 8) & 0xff]
  for (const b of bytes) { h ^= b + 1000; h = Math.imul(h, 16777619) >>> 0 }
  return (h >>> 0) % N_VARIANTS
}

// ─── grid-based layout ────────────────────────────────────────────────────────

function buildLayout(
  items: CanvasItemType[],
  variant: number,
  seed: string,
): Map<string, { x: number; y: number }> {
  if (items.length === 0) return new Map()

  const n    = items.length
  const cols = Math.max(2, Math.round(Math.sqrt(n * TILE_W / TILE_H)))
  const rows = Math.ceil(n / cols)
  const cellW = (TILE_W - 2 * EDGE_MARGIN) / cols
  const cellH = (TILE_H - 2 * EDGE_MARGIN) / rows

  const shuffled = [...items].sort(
    (a, b) => rand(seed + a._key + ':ord:v' + variant, 0) - rand(seed + b._key + ':ord:v' + variant, 0)
  )

  const map = new Map<string, { x: number; y: number }>()
  shuffled.forEach((item, i) => {
    const w = DEFAULT_W
    const h = item._type === 'canvasPostit' ? Math.round(w * 1.1) : Math.round(w * 0.75)
    const col = i % cols
    const row = Math.floor(i / cols)

    const cellCX = EDGE_MARGIN + (col + 0.5) * cellW
    const cellCY = EDGE_MARGIN + (row + 0.5) * cellH

    const maxJX = Math.max(0, (cellW - w) / 2) * 0.8
    const maxJY = Math.max(0, (cellH - h) / 2) * 0.8
    const jX = (rand(seed + item._key + ':jx:v' + variant, 0) - 0.5) * 2 * maxJX
    const jY = (rand(seed + item._key + ':jy:v' + variant, 0) - 0.5) * 2 * maxJY

    map.set(item._key, {
      x: cellCX + jX - w / 2 - TILE_W / 2,
      y: cellCY + jY - h / 2 - TILE_H / 2,
    })
  })

  return map
}

// ─── visible tiles ────────────────────────────────────────────────────────────

function visibleTiles(ox: number, oy: number, vw: number, vh: number) {
  const l = -vw / 2 - ox,  r = vw / 2 - ox
  const t = -vh / 2 - oy,  b = vh / 2 - oy
  const out: { tx: number; ty: number }[] = []
  for (let tx = Math.floor(l / TILE_W) - 1; tx <= Math.ceil(r / TILE_W) + 1; tx++)
    for (let ty = Math.floor(t / TILE_H) - 1; ty <= Math.ceil(b / TILE_H) + 1; ty++)
      out.push({ tx, ty })
  return out
}

// ─── component ────────────────────────────────────────────────────────────────

interface Props {
  items: CanvasItemType[]
  centerText?: LocalizedString
  locale: string
}

export default function InfiniteCanvas({ items, centerText, locale }: Props) {
  // offset/viewSize state is used only for tile visibility — the visual
  // transform goes straight to the DOM so React never causes animation jank
  const [offset, setOffset]     = useState({ x: 0, y: 0 })
  const [viewSize, setViewSize] = useState({ w: 1440, h: 900 })
  const [ready, setReady]       = useState(false)

  const containerRef  = useRef<HTMLDivElement>(null)
  const innerRef      = useRef<HTMLDivElement>(null)

  // offsetRef  — current visual position
  // targetRef  — where we want to be (lerp chases it)
  // viewSizeRef — viewport size without depending on React state in callbacks
  const offsetRef   = useRef({ x: 0, y: 0 })
  const targetRef   = useRef({ x: 0, y: 0 })
  const viewSizeRef = useRef({ w: 1440, h: 900 })
  const velocity    = useRef({ x: 0, y: 0 })
  const isDragging  = useRef(false)
  const dragStart   = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const posBuf      = useRef<{ x: number; y: number; t: number }[]>([])

  const raf      = useRef<number | null>(null)
  const animMode = useRef<'lerp' | 'fling' | null>(null)

  // ── apply transform directly to DOM ──────────────────────────────────────
  // Uses translate3d so Safari/WebKit promotes the element to its own GPU
  // compositor layer. The viewport centre is baked into the transform so the
  // element can sit at position:fixed left:0 top:0 — no layout dependency.
  const applyTransform = useCallback((x: number, y: number) => {
    offsetRef.current.x = x
    offsetRef.current.y = y
    if (innerRef.current) {
      const { w, h } = viewSizeRef.current
      innerRef.current.style.transform =
        `translate3d(${w / 2 + x}px,${h / 2 + y}px,0)`
    }
  }, [])

  // Throttled React state update for tile recalculation.
  // Called directly (not via a nested RAF) to avoid frame-stealing.
  const frameCount = useRef(0)
  const syncTiles = useCallback((force = false) => {
    if (force || ++frameCount.current % 6 === 0) {
      setOffset({ x: offsetRef.current.x, y: offsetRef.current.y })
    }
  }, [])

  // ── cancel active animation ───────────────────────────────────────────────
  const cancelAnim = useCallback(() => {
    if (raf.current !== null) { cancelAnimationFrame(raf.current); raf.current = null }
    animMode.current = null
  }, [])

  // ── lerp loop — smoothly chases targetRef ─────────────────────────────────
  const startLerp = useCallback(() => {
    if (animMode.current === 'lerp') return   // already running; target already updated
    cancelAnim()
    animMode.current = 'lerp'

    const tick = () => {
      const dx = targetRef.current.x - offsetRef.current.x
      const dy = targetRef.current.y - offsetRef.current.y

      if (Math.abs(dx) < 0.08 && Math.abs(dy) < 0.08) {
        applyTransform(targetRef.current.x, targetRef.current.y)
        setOffset({ x: targetRef.current.x, y: targetRef.current.y })
        animMode.current = null
        raf.current = null
        return
      }

      applyTransform(
        offsetRef.current.x + dx * LERP,
        offsetRef.current.y + dy * LERP,
      )
      syncTiles()
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [cancelAnim, applyTransform, syncTiles])

  // ── fling loop — velocity × friction, direct (no lerp lag on throw) ──────
  const startFling = useCallback(() => {
    cancelAnim()
    animMode.current = 'fling'

    const tick = () => {
      velocity.current.x *= FRICTION
      velocity.current.y *= FRICTION

      if (Math.abs(velocity.current.x) < MIN_V && Math.abs(velocity.current.y) < MIN_V) {
        velocity.current.x = 0
        velocity.current.y = 0
        targetRef.current.x = offsetRef.current.x
        targetRef.current.y = offsetRef.current.y
        setOffset({ x: offsetRef.current.x, y: offsetRef.current.y })
        animMode.current = null
        raf.current = null
        return
      }

      const nx = offsetRef.current.x + velocity.current.x
      const ny = offsetRef.current.y + velocity.current.y
      targetRef.current.x = nx
      targetRef.current.y = ny
      applyTransform(nx, ny)
      syncTiles()
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [cancelAnim, applyTransform, syncTiles])

  const launchFling = useCallback(() => {
    const buf = posBuf.current
    if (buf.length < 2) return
    const first = buf[0], last = buf[buf.length - 1]
    const dt = last.t - first.t
    if (dt <= 0) return
    velocity.current.x = ((last.x - first.x) / dt) * 16.67
    velocity.current.y = ((last.y - first.y) / dt) * 16.67
    startFling()
  }, [startFling])

  // ── mouse drag — 1:1, no lerp ─────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a, button, video')) return
    cancelAnim()
    isDragging.current = true
    posBuf.current = []
    dragStart.current = {
      x: e.clientX, y: e.clientY,
      ox: offsetRef.current.x, oy: offsetRef.current.y,
    }
    e.preventDefault()
  }, [cancelAnim])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    const now = performance.now()
    posBuf.current.push({ x: e.clientX, y: e.clientY, t: now })
    posBuf.current = posBuf.current.filter(p => now - p.t < 80)
    const x = dragStart.current.ox + (e.clientX - dragStart.current.x)
    const y = dragStart.current.oy + (e.clientY - dragStart.current.y)
    targetRef.current.x = x
    targetRef.current.y = y
    applyTransform(x, y)
    syncTiles()
  }, [applyTransform, syncTiles])

  const onMouseUp = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    launchFling()
  }, [launchFling])

  // ── touch ─────────────────────────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    cancelAnim()
    isDragging.current = true
    posBuf.current = []
    const t = e.touches[0]
    dragStart.current = {
      x: t.clientX, y: t.clientY,
      ox: offsetRef.current.x, oy: offsetRef.current.y,
    }
  }, [cancelAnim])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return
    const t = e.touches[0], now = performance.now()
    posBuf.current.push({ x: t.clientX, y: t.clientY, t: now })
    posBuf.current = posBuf.current.filter(p => now - p.t < 80)
    const x = dragStart.current.ox + (t.clientX - dragStart.current.x)
    const y = dragStart.current.oy + (t.clientY - dragStart.current.y)
    targetRef.current.x = x
    targetRef.current.y = y
    applyTransform(x, y)
    syncTiles()
    e.preventDefault()
  }, [applyTransform, syncTiles])

  const onTouchEnd = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    launchFling()
  }, [launchFling])

  // ── trackpad / wheel — updates target, lerp loop chases it ───────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      if (animMode.current === 'fling') cancelAnim()

      const s = e.deltaMode === 1 ? 20 : e.deltaMode === 2 ? 300 : 1
      targetRef.current.x -= e.deltaX * s
      targetRef.current.y -= e.deltaY * s
      startLerp()
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [cancelAnim, startLerp])

  // ── viewport size ─────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth, h = window.innerHeight
      viewSizeRef.current = { w, h }
      setViewSize({ w, h })
      // Re-apply transform so the baked-in centre value is correct after resize
      applyTransform(offsetRef.current.x, offsetRef.current.y)
    }
    update()
    setReady(true)
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('resize', update); cancelAnim() }
  }, [applyTransform, cancelAnim])

  // ── render ────────────────────────────────────────────────────────────────
  // Seed must be generated client-side only — Math.random() on the server
  // produces a different value than on the client, causing a hydration mismatch.
  // useState(null) SSRs as null on both server and client (no mismatch),
  // then useEffect sets the real seed after hydration.
  const [seed, setSeed] = useState<string | null>(null)
  useEffect(() => { setSeed(Math.random().toString(36).slice(2)) }, [])

  const layouts = useMemo(
    () => seed !== null
      ? Array.from({ length: N_VARIANTS }, (_, v) => buildLayout(items, v, seed))
      : [],
    [items, seed]
  )

  const tiles = visibleTiles(offset.x, offset.y, viewSize.w, viewSize.h)

  const displayText = locale === 'de' ? centerText?.de : (centerText?.en ?? centerText?.de)
  const lines = displayText?.split('\n') ?? []

  return (
    <div
      ref={containerRef}
      className="canvas-container fixed inset-0 overflow-hidden select-none"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-10">
        <div className="text-center">
          <span className="block font-build text-3xl leading-none">Studio</span>
          <span className="block font-build text-3xl font-medium leading-none">VIA</span>
          <div style={{ marginTop: 30 }}>
            {lines.map((line, i) => (
              <span key={i} className="block font-build text-3xl text-via-gray leading-none">{line}</span>
            ))}
          </div>
        </div>
      </div>

      {/* position:fixed left:0 top:0 so this element has no layout dependency.
          translate3d forces a GPU compositor layer in Safari/WebKit.
          The viewport centre is baked into the transform value via applyTransform. */}
      <div
        ref={innerRef}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          willChange: 'transform',
          opacity: ready ? 1 : 0,
          transition: 'opacity 0.6s ease',
        }}
      >
        {seed !== null && tiles.map(({ tx, ty }) => {
          const layout = layouts[tileVariant(tx, ty)]
          return (
            <Fragment key={`${tx}:${ty}`}>
              {items.map((item) => {
                const pos = layout.get(item._key)
                if (!pos) return null
                return (
                  <div
                    key={item._key}
                    style={{
                      position: 'absolute',
                      left:   pos.x + tx * TILE_W,
                      top:    pos.y + ty * TILE_H,
                      zIndex: 1,
                    }}
                  >
                    <CanvasItem item={item} locale={locale} />
                  </div>
                )
              })}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
