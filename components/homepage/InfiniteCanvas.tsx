'use client'
import { useRef, useState, useCallback, useMemo, useEffect, Fragment } from 'react'
import type { CanvasItem as CanvasItemType, LocalizedString } from '@/lib/types'
import CanvasItem from './CanvasItem'

// ─── layout constants ─────────────────────────────────────────────────────────

const EDGE_MARGIN = 180
const DEFAULT_W   = 360
const N_VARIANTS  = 4
const FALLBACK_ASPECT = 4 / 3  // width/height used when an item has no aspect-ratio metadata (e.g. video)
const POSTIT_ASPECT   = 1.1    // postit card height = width * POSTIT_ASPECT (a fixed UI card, not a photo)
const POSTIT_SIZE     = 1      // postits always render at this size tier — never randomized
const TILE_ASPECT     = 2800 / 1900  // target tile width:height ratio
const STAGGER_FRAC    = 0.03  // fraction of cell size alternating cells are offset by — a soft corner bias, not a proof
const JITTER_MULT     = 0.8   // fraction of each item's own per-cell slack used for jitter

// Photo size varies per item — mostly medium/large, occasionally a small
// accent image — instead of every item rendering at the same fixed size.
// Postits are excluded from this and always render at POSTIT_SIZE.
const SIZE_TIERS = [0.7, 1.2, 1.5, 1.5, 1.8, 1.8, 2, 2]
const MAX_SIZE_TIER = Math.max(...SIZE_TIERS, POSTIT_SIZE)
const W_MAX = DEFAULT_W * MAX_SIZE_TIER

// Packed tight for a dense collage look. Best-effort, not a hard overlap
// guarantee: worst case (two max-size items landing in neighboring cells,
// both jittered toward each other) tops out around 5% overlap — while
// typical/smaller items usually clear their neighbors entirely.
const CELL_W = W_MAX * 1.05
const CELL_H = CELL_W * POSTIT_ASPECT

// ─── tile grid sizing ─────────────────────────────────────────────────────────

function computeTileGrid(n: number) {
  const cols = Math.max(2, Math.round(Math.sqrt(Math.max(n, 1) * TILE_ASPECT * POSTIT_ASPECT)))
  const rows = Math.max(1, Math.ceil(Math.max(n, 1) / cols))
  return {
    cols, rows,
    tileW: cols * CELL_W + 2 * EDGE_MARGIN,
    tileH: rows * CELL_H + 2 * EDGE_MARGIN,
  }
}

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

// Maps a uniform [0,1) draw to (-1, 1), biased toward ±1. Uniform jitter
// mostly lands near the middle of its allowed range, so two neighbors rarely
// both reach toward each other at once — overlap stays theoretically
// possible but practically never happens. Biasing toward the extremes makes
// items commonly sit near the edge of their range, so overlap is a frequent
// outcome instead of a rare one, while never exceeding the same maxJX/maxJY
// bound (the 5% cap on any single overlap is unaffected).
function biasedUnit(r: number): number {
  const u = r * 2 - 1
  return Math.sign(u) * Math.abs(u) ** 0.4
}

// ─── variant assignment per tile ──────────────────────────────────────────────

function tileVariant(tx: number, ty: number): number {
  let h = 2166136261 >>> 0
  const bytes = [tx & 0xff, (tx >> 8) & 0xff, ty & 0xff, (ty >> 8) & 0xff]
  for (const b of bytes) { h ^= b + 1000; h = Math.imul(h, 16777619) >>> 0 }
  return (h >>> 0) % N_VARIANTS
}

// ─── grid-based layout ────────────────────────────────────────────────────────

// width / height for a given item — real photo aspect ratio when known
// (from Sanity's image metadata), a fixed ratio for postit cards, and a
// fallback for anything without metadata (e.g. video).
function itemAspect(item: CanvasItemType): number {
  if (item._type === 'canvasPostit') return 1 / POSTIT_ASPECT
  const ar = item.image?.asset?.metadata?.dimensions?.aspectRatio
  return ar && ar > 0 ? ar : FALLBACK_ASPECT
}

function buildLayout(
  items: CanvasItemType[],
  variant: number,
  seed: string,
  grid: { cols: number; rows: number; tileW: number; tileH: number },
): Map<string, { x: number; y: number; w: number; h: number }> {
  if (items.length === 0) return new Map()

  const { cols, rows, tileW, tileH } = grid

  // Offset alternating cells (checkerboard, by row+col parity) so same-row and
  // same-column neighbors don't share an exact baseline — a soft bias that
  // makes any overlap read as a corner rather than a full-edge strip.
  const staggerX = CELL_W * STAGGER_FRAC
  const staggerY = CELL_H * STAGGER_FRAC

  const shuffled = [...items].sort(
    (a, b) => rand(seed + a._key + ':ord:v' + variant, 0) - rand(seed + b._key + ':ord:v' + variant, 0)
  )

  // Shuffle which grid cell each item lands in (rather than filling cells in
  // sequential order) so that when items don't evenly fill the grid, the
  // leftover empty cells are scattered across the tile instead of clumping
  // together at the tail — a clump of empty cells reads as one large gap.
  const cellIndices = Array.from({ length: rows * cols }, (_, i) => i).sort(
    (a, b) => rand(seed + ':cell:' + a + ':v' + variant, 0) - rand(seed + ':cell:' + b + ':v' + variant, 0)
  )

  const map = new Map<string, { x: number; y: number; w: number; h: number }>()
  shuffled.forEach((item, i) => {
    const sizeTier = item._type === 'canvasPostit'
      ? POSTIT_SIZE
      : SIZE_TIERS[Math.floor(rand(seed + item._key + ':size:v' + variant, 0) * SIZE_TIERS.length)]
    const w = Math.round(DEFAULT_W * sizeTier)
    const h = Math.round(w / itemAspect(item))

    const cellIndex = cellIndices[i]
    const col = cellIndex % cols
    const row = Math.floor(cellIndex / cols)

    const parity = (row + col) % 2 === 0 ? 1 : -1
    const cellCX = EDGE_MARGIN + (col + 0.5) * CELL_W + parity * staggerX
    const cellCY = EDGE_MARGIN + (row + 0.5) * CELL_H + parity * staggerY

    // Smaller items (well under CELL_W/CELL_H) get generous room to roam, so
    // they mostly land clear of their neighbors. Larger items have less
    // slack and more often nudge into a neighbor's corner — biasedUnit below
    // then pushes typical draws toward that edge instead of the cell center.
    const maxJX = Math.max(0, (CELL_W - w) / 2) * JITTER_MULT
    const maxJY = Math.max(0, (CELL_H - h) / 2) * JITTER_MULT
    const jX = biasedUnit(rand(seed + item._key + ':jx:v' + variant, 0)) * maxJX
    const jY = biasedUnit(rand(seed + item._key + ':jy:v' + variant, 0)) * maxJY

    map.set(item._key, {
      x: cellCX + jX - w / 2 - tileW / 2,
      y: cellCY + jY - h / 2 - tileH / 2,
      w,
      h,
    })
  })

  return map
}

// ─── visible tiles ────────────────────────────────────────────────────────────

function visibleTiles(ox: number, oy: number, vw: number, vh: number, tileW: number, tileH: number) {
  const l = -vw / 2 - ox,  r = vw / 2 - ox
  const t = -vh / 2 - oy,  b = vh / 2 - oy
  const out: { tx: number; ty: number }[] = []
  for (let tx = Math.floor(l / tileW) - 1; tx <= Math.ceil(r / tileW) + 1; tx++)
    for (let ty = Math.floor(t / tileH) - 1; ty <= Math.ceil(b / tileH) + 1; ty++)
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

  // Grid dimensions (and so tile size) scale with item count so items always
  // render at full DEFAULT_W — rather than shrinking items to fit a
  // fixed-size tile, the tile grows to fit however many items there are.
  const grid = useMemo(() => computeTileGrid(items.length), [items.length])

  const layouts = useMemo(
    () => seed !== null
      ? Array.from({ length: N_VARIANTS }, (_, v) => buildLayout(items, v, seed, grid))
      : [],
    [items, seed, grid]
  )

  const tiles = visibleTiles(offset.x, offset.y, viewSize.w, viewSize.h, grid.tileW, grid.tileH)

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
                      left:   pos.x + tx * grid.tileW,
                      top:    pos.y + ty * grid.tileH,
                      zIndex: 1,
                    }}
                  >
                    <CanvasItem item={item} locale={locale} width={pos.w} height={pos.h} />
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
