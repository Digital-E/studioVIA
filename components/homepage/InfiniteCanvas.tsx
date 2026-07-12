'use client'
import { useRef, useState, useCallback, useMemo, useEffect, Fragment } from 'react'
import Link from 'next/link'
import type { CanvasItem as CanvasItemType, LocalizedString } from '@/lib/types'
import CanvasItem from './CanvasItem'

// ─── layout constants ─────────────────────────────────────────────────────────

const EDGE_MARGIN = 180
const DEFAULT_W   = 360
const VARIANT_GRID = 4  // K — variants form a KxK repeating pattern (see tileVariant)
const N_VARIANTS  = VARIANT_GRID * VARIANT_GRID
const FALLBACK_ASPECT = 4 / 3  // width/height used when an item has no aspect-ratio metadata (e.g. video)
const POSTIT_ASPECT   = 1.1    // postit card height = width * POSTIT_ASPECT (a fixed UI card, not a photo)
const POSTIT_SIZE     = 1      // postits always render at this size tier — never randomized
const TILE_ASPECT     = 2800 / 1900  // target tile width:height ratio
const STAGGER_FRAC    = 0.06  // fraction of cell size alternating cells are offset by — a soft corner bias, not a proof
const JITTER_MULT     = 0.55  // fraction of each item's own per-cell slack used for jitter — kept under 1 so an item never fully leaves its own cell (the resolver's t=0 fallback stays safe). Kept well under 1 (not just <1) so items stay near their cell center rather than roaming to the far edge, which is what was reading as big empty gaps between neighbors.
const BACKDROP_BLEED  = 60    // px each per-tile blend backdrop rect extends past its own tile bounds, so content spilling past a tile edge (e.g. a credit caption below its image) still lands on a painted backdrop instead of a seam
// Padding added to the item count fed into computeTileGrid, purely so the
// grid always has a few cells to spare for the center-text reservation in
// placeVariant (see CENTER_CLEAR_HALF_W/H there). Without this, a grid sized
// exactly to the item count can leave too few free cells to reserve, so the
// reservation silently gives up rather than dropping real content — the
// exact case at today's item count (11 items -> a 4x3 grid has no slack).
// The unused padding elsewhere (variants 1-15, and any cells the reservation
// doesn't end up needing) is simply absorbed by the existing repeat-filler
// mechanism, the same as any other leftover cell.
const CENTER_RESERVE_PAD_CELLS = 4

// Below this viewport width, tiles render smaller (see MOBILE_SCALE) — desktop is unaffected.
const MOBILE_BREAKPOINT = 768
const MOBILE_SCALE = 0.6

// Photo size varies per item — mostly medium/large, occasionally a small
// accent image — instead of every item rendering at the same fixed size.
// Postits are excluded from this and always render at POSTIT_SIZE.
const SIZE_TIERS = [1, 1.25, 1.4, 1.4, 1.6, 1.6, 1.7, 1.7]
// Cell size is based on this average, not the max tier above — most items
// draw a tier well under the max, so sizing every cell to comfortably fit
// the rare largest tile left a lot of empty margin around the common,
// smaller ones. The rare item that does draw above this still renders at
// full size — it's just clamped to the cell if it doesn't fit (see the
// w > cellW check in placeVariant) and/or allowed to overlap a neighbor up
// to MAX_OVERLAP_FRAC, both already handled below.
const TYPICAL_SIZE_TIER = SIZE_TIERS.reduce((a, b) => a + b, 0) / SIZE_TIERS.length

// Hard cap on overlap area (as a fraction of the smaller item's own area)
// between any two neighboring items. Enforced by measuring actual placed
// boxes and pulling pairs apart below, not by assuming a worst case up front.
const MAX_OVERLAP_FRAC = 0.2

// ─── responsive sizing constants ─────────────────────────────────────────────

// All absolute pixel sizing derives from DEFAULT_W/EDGE_MARGIN scaled down
// together on mobile, so the collage's proportions (jitter, stagger, overlap
// caps) stay identical — only the physical tile size shrinks.
interface SizeConstants {
  defaultW: number
  edgeMargin: number
  cellW: number
  cellH: number
}

function computeSizeConstants(isMobile: boolean): SizeConstants {
  const scale = isMobile ? MOBILE_SCALE : 1
  const defaultW = DEFAULT_W * scale
  const edgeMargin = EDGE_MARGIN * scale
  const wTypical = defaultW * TYPICAL_SIZE_TIER
  // Packed tight for a dense collage look.
  const cellW = wTypical * 1.05
  const cellH = cellW * POSTIT_ASPECT
  return { defaultW, edgeMargin, cellW, cellH }
}

// ─── tile grid sizing ─────────────────────────────────────────────────────────

function computeTileGrid(n: number, c: SizeConstants) {
  const count = Math.max(n, 1)
  const target = Math.sqrt(count * TILE_ASPECT * POSTIT_ASPECT)
  const targetCols = Math.max(2, Math.round(target))

  // A cols pick straight from the target aspect ratio can leave rows*cols
  // well above n (e.g. n=20 -> 6 cols x 4 rows = 24 cells for 20 items) —
  // the leftover cells render with nothing placed in them, showing up as
  // flat empty gaps in the collage rather than jitter-sized gaps. Search a
  // small range of column counts around the target and prefer whichever
  // leaves the fewest empty cells, only falling back to aspect-closeness to
  // break ties among equally-full options.
  let cols = targetCols
  let bestLeftover = Infinity
  let bestDist = Infinity
  for (let cCols = Math.max(2, targetCols - 3); cCols <= targetCols + 3; cCols++) {
    const cRows = Math.max(1, Math.ceil(count / cCols))
    const leftover = cRows * cCols - count
    const dist = Math.abs(cCols - target)
    if (leftover < bestLeftover || (leftover === bestLeftover && dist < bestDist)) {
      bestLeftover = leftover
      bestDist = dist
      cols = cCols
    }
  }

  const rows = Math.max(1, Math.ceil(count / cols))
  return {
    cols, rows,
    tileW: cols * c.cellW + 2 * c.edgeMargin,
    tileH: rows * c.cellH + 2 * c.edgeMargin,
  }
}

// ─── physics ──────────────────────────────────────────────────────────────────

const LERP     = 0.08   // fraction of gap closed per frame for wheel/trackpad
const FRICTION = 0.96   // velocity decay per frame for drag-fling
const MIN_V    = 0.2    // px/frame threshold to stop fling
const DRAG_THRESHOLD = 5 // px of movement before a mousedown counts as a pan, not a click

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

// Assigning purely by (tx mod K, ty mod K) means every one of a tile's 8
// neighbors — which differ from it by exactly ±1 in tx and/or ty — lands on
// a different (mod K) coordinate on at least one axis (true for any K >= 2),
// so the resulting (ax, ay) pair always differs too: two adjacent tiles can
// never render the identical layout, no matter how large K is. Larger K
// means more distinct layouts, so the same photo arrangement repeats far
// less often while panning.
function tileVariant(tx: number, ty: number): number {
  const ax = ((tx % VARIANT_GRID) + VARIANT_GRID) % VARIANT_GRID
  const ay = ((ty % VARIANT_GRID) + VARIANT_GRID) % VARIANT_GRID
  return ax * VARIANT_GRID + ay
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

interface Placed {
  key: string
  // the real underlying item this placement renders — equal to `key` for a
  // normal placement, but distinct when this slot is a repeat (see the
  // "filler" pass in placeVariant) filling a grid cell no real item reached
  itemKey: string
  isPostit: boolean
  isImage: boolean
  w: number; h: number
  col: number; row: number
  // nominal (unstaggered) cell center
  baseCX: number; baseCY: number
  // stagger + jitter combined into one offset, scaled by `t` below —
  // t=1 is the full offset (original behavior), t=0 is the bare
  // unstaggered cell center, which by construction (item ≤ its own cell)
  // never overlaps a same-sized neighbor. Decaying t therefore always has
  // somewhere safe to converge to.
  offX: number; offY: number
  t: number
}

// Grid neighbors (8-connected). A cell at the tile's own edge wraps to the
// opposite edge — but since tileVariant() guarantees adjacent tiles are
// never the same variant, that opposite edge belongs to a *different*
// variant's layout, not another copy of this one.
const NEIGHBOR_OFFSETS: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
]

// The variant a neighboring tile at offset (dx, dy) has, given this tile is
// `v`. Since tileVariant() assigns variant = (tx mod K)*K + (ty mod K), the
// neighbor's variant is just that same formula applied to the offset
// coordinates mod K — unlike the old K=2 case, left/right (or top/bottom)
// neighbors generally land on *different* variants from each other now, not
// a single shared "flip", so every one of the 8 offsets is resolved
// individually.
function neighborVariant(v: number, dx: number, dy: number): number {
  const ax = Math.floor(v / VARIANT_GRID), ay = v % VARIANT_GRID
  const nax = ((ax + dx) % VARIANT_GRID + VARIANT_GRID) % VARIANT_GRID
  const nay = ((ay + dy) % VARIANT_GRID + VARIANT_GRID) % VARIANT_GRID
  return nax * VARIANT_GRID + nay
}

// ── pass 1+2: place every item for one variant (cell, size, jitter) ────────
// Collision resolution happens afterward, once all 4 variants are placed —
// see buildAllLayouts.
function placeVariant(
  items: CanvasItemType[],
  variant: number,
  seed: string,
  grid: { cols: number; rows: number; tileW: number; tileH: number },
  c: SizeConstants,
): { placed: Placed[]; cellToPlacedIndex: Map<number, number> } {
  const { cols, rows, tileW, tileH } = grid
  const { defaultW, edgeMargin, cellW, cellH } = c

  // Offset alternating cells (checkerboard, by row+col parity) so same-row and
  // same-column neighbors don't share an exact baseline — a soft bias that
  // makes any overlap read as a corner rather than a full-edge strip.
  const staggerX = cellW * STAGGER_FRAC
  const staggerY = cellH * STAGGER_FRAC

  // Postits sort first (ties broken by the usual random order) so they claim
  // whichever cells are prioritized below — normally that's a no-op, but
  // combined with the interior-cell priority next, it lets a postit (of
  // which there's typically only one) claim an interior cell ahead of
  // everything else.
  const shuffled = [...items].sort((a, b) => {
    const pa = a._type === 'canvasPostit' ? 0 : 1
    const pb = b._type === 'canvasPostit' ? 0 : 1
    if (pa !== pb) return pa - pb
    return rand(seed + a._key + ':ord:v' + variant, 0) - rand(seed + b._key + ':ord:v' + variant, 0)
  })

  // Shuffle which grid cell each item lands in (rather than filling cells in
  // sequential order) so that when items don't evenly fill the grid, the
  // leftover empty cells are scattered across the tile instead of clumping
  // together at the tail — a clump of empty cells reads as one large gap.
  //
  // Interior cells (not touching this tile's own edge) sort first. A tile
  // only ever repeats a single rare item (e.g. one postit) once per
  // instance, so if that item lands near the tile's edge, an adjacent tile's
  // independently-placed copy of the very same item can end up right next
  // to it on screen — reading as an accidental duplicate. Keeping it away
  // from every edge means no neighboring tile's copy can ever land close
  // enough to look that way.
  const isInterior = (cellIndex: number) => {
    const col = cellIndex % cols, row = Math.floor(cellIndex / cols)
    return col > 0 && col < cols - 1 && row > 0 && row < rows - 1
  }
  const cellIndices = Array.from({ length: rows * cols }, (_, i) => i).sort((a, b) => {
    const ia = isInterior(a) ? 0 : 1, ib = isInterior(b) ? 0 : 1
    if (ia !== ib) return ia - ib
    return rand(seed + ':cell:' + a + ':v' + variant, 0) - rand(seed + ':cell:' + b + ':v' + variant, 0)
  })

  // Variant 0's dead-center cells are kept permanently empty. Panning starts
  // at offset (0,0), which puts tile (0,0) — always variant 0, see
  // tileVariant — directly behind the fixed, centered "Studio VIA" text
  // overlay (see the InfiniteCanvas render below), so reserving this zone
  // here, before any item or filler claims it, guarantees no photo (or
  // postit) ever loads underneath that text on the very first screen.
  // Scoped to variant 0 only (not every variant) — reserving the same
  // relative cells everywhere would leave an identical blank hole in every
  // tile, which reads as a repeating grid artifact once you pan away,
  // defeating the whole point of the per-variant randomization.
  //
  // This is a rectangle sized to the text block, not a single cell: when
  // cols or rows is even (as with cols=4 at today's item count), the tile's
  // exact numeric center falls precisely on the boundary between two cells,
  // not inside either one. Reserving only whichever single cell floor(cols/2)
  // picks leaves its neighbor across that boundary completely unreserved —
  // and the text is center-aligned, so it extends into that neighbor too.
  // Intersecting a real rectangle against every cell instead reserves
  // however many cells the text actually spans (1, 2, or 4, depending on
  // parity), so nothing can jitter up to the boundary and still clip it.
  const CENTER_CLEAR_HALF_W = defaultW * 0.7
  const CENTER_CLEAR_HALF_H = defaultW * 0.55
  const clearLeft = tileW / 2 - CENTER_CLEAR_HALF_W
  const clearRight = tileW / 2 + CENTER_CLEAR_HALF_W
  const clearTop = tileH / 2 - CENTER_CLEAR_HALF_H
  const clearBottom = tileH / 2 + CENTER_CLEAR_HALF_H
  const cellIntersectsClearZone = (idx: number) => {
    const col = idx % cols, row = Math.floor(idx / cols)
    const left = edgeMargin + col * cellW, right = left + cellW
    const top = edgeMargin + row * cellH, bottom = top + cellH
    return left < clearRight && right > clearLeft && top < clearBottom && bottom > clearTop
  }
  const reservedCellIndices = variant === 0 ? new Set(cellIndices.filter(cellIntersectsClearZone)) : new Set<number>()
  // Only reserve if there's still a cell for every real (non-filler) item
  // without them — with very few items in the CMS, losing cells to the
  // reservation could otherwise mean dropping real content, which is worse
  // than the text briefly sitting over a tile.
  const canReserveCenter = cellIndices.length - reservedCellIndices.size >= shuffled.length
  const fillableCellIndices = canReserveCenter
    ? cellIndices.filter((idx) => !reservedCellIndices.has(idx))
    : cellIndices

  // A grid sized from cols/rows targeting an aspect ratio can leave more
  // cells than items — e.g. 11 items is prime, so the only zero-leftover
  // grids are a degenerate 1x11 or 11x1 strip (see computeTileGrid). Rather
  // than leave those cells fully empty (a hole exactly the size of a cell —
  // the "huge white area" this whole layout is built to avoid), repeat
  // non-postit items to fill them. A repeated photo reads as an intentional
  // collage choice; a blank hole reads as a bug. Postits are excluded from
  // the repeat pool since there's normally exactly one — two identical
  // "1st Prize" cards in the same tile would look like a glitch, not a
  // repeat. Each slot gets its own placementKey (distinct from the item's
  // real _key) so its size/jitter is independently randomized rather than
  // mirroring the item's original placement, and so the final layout Map
  // (keyed by placementKey below) can hold both without colliding.
  const fillPool = items.filter((it) => it._type !== 'canvasPostit')
    .sort((a, b) => rand(seed + a._key + ':fill:v' + variant, 0) - rand(seed + b._key + ':fill:v' + variant, 0))
  const numExtra = Math.max(0, fillableCellIndices.length - shuffled.length)
  const slots: { item: CanvasItemType; placementKey: string }[] = [
    ...shuffled.map((item) => ({ item, placementKey: item._key })),
    ...(fillPool.length > 0
      ? Array.from({ length: numExtra }, (_, i) => ({
          item: fillPool[i % fillPool.length],
          placementKey: fillPool[i % fillPool.length]._key + ':fill' + i,
        }))
      : []),
  ]

  // Assigns each slot's cell on demand (rather than a fixed 1:1 zip against
  // fillableCellIndices) so a repeated item's filler copy can be steered
  // away from any cell already holding that same item — including its own
  // original placement. Two occurrences of the same photo landing in
  // touching cells reads as an obvious mistake, not an intentional repeat,
  // so "already holding" also excludes the 8 neighboring cells, not just an
  // exact match. Distinct items never conflict with each other here, so
  // this reduces to the previous fixed-order assignment for every item that
  // only appears once (i.e. every real item, unless it's also the fill
  // pool's source for a repeat).
  const remainingCells = [...fillableCellIndices]
  const usedCellsByItemKey = new Map<string, number[]>()
  const cellsAreNear = (a: number, b: number) => {
    const ca = a % cols, ra = Math.floor(a / cols)
    const cb = b % cols, rb = Math.floor(b / cols)
    return Math.abs(ca - cb) <= 1 && Math.abs(ra - rb) <= 1
  }
  const pickCellFor = (itemKey: string): number => {
    const used = usedCellsByItemKey.get(itemKey) ?? []
    let pickAt = remainingCells.findIndex((c) => !used.some((u) => cellsAreNear(c, u)))
    if (pickAt === -1) pickAt = 0 // no conflict-free cell left — take the next one anyway rather than fail
    const cellIndex = remainingCells.splice(pickAt, 1)[0]
    used.push(cellIndex)
    usedCellsByItemKey.set(itemKey, used)
    return cellIndex
  }

  // ── pass 1: assign each item's cell, size, and base (unjittered) center ────
  const placed: Placed[] = []
  const cellToPlacedIndex = new Map<number, number>()

  slots.forEach(({ item, placementKey }) => {
    const sizeTier = item._type === 'canvasPostit'
      ? POSTIT_SIZE
      : SIZE_TIERS[Math.floor(rand(seed + placementKey + ':size:v' + variant, 0) * SIZE_TIERS.length)]
    let w = Math.round(defaultW * sizeTier)
    let h = Math.round(w / itemAspect(item))

    // An item taller or wider than its own cell would overflow into
    // neighboring cells just from being centered, regardless of jitter —
    // bound it to the cell first so the collision pass below has a
    // guaranteed-safe fallback (t=0) to fall back to.
    if (w > cellW || h > cellH) {
      const scale = Math.min(cellW / w, cellH / h)
      w = Math.round(w * scale)
      h = Math.round(h * scale)
    }

    const cellIndex = pickCellFor(item._key)
    const col = cellIndex % cols
    const row = Math.floor(cellIndex / cols)
    const baseCX = edgeMargin + (col + 0.5) * cellW
    const baseCY = edgeMargin + (row + 0.5) * cellH

    cellToPlacedIndex.set(cellIndex, placed.length)
    placed.push({
      key: placementKey,
      itemKey: item._key,
      isPostit: item._type === 'canvasPostit',
      isImage: item._type === 'canvasMedia' && !!item.image && !item.video,
      w, h, col, row,
      baseCX, baseCY,
      offX: 0, offY: 0,
      t: 1,
    })
  })

  // ── pass 2a: jitter for every non-postit item ─────────────────────────────
  // Postits are handled separately below, once every other item's position
  // is already final — see that pass for why.
  placed.forEach((p) => {
    if (p.isPostit) return
    const parity = (p.row + p.col) % 2 === 0 ? 1 : -1

    // Smaller items (well under cellW/cellH) get generous room to roam, so
    // they mostly land clear of their neighbors. Larger items have less
    // slack and more often nudge into a neighbor's corner — biasedUnit below
    // then pushes typical draws toward that edge instead of the cell center.
    const maxJX = Math.max(0, (cellW - p.w) / 2) * JITTER_MULT
    const maxJY = Math.max(0, (cellH - p.h) / 2) * JITTER_MULT
    const jX = biasedUnit(rand(seed + p.key + ':jx:v' + variant, 0)) * maxJX
    const jY = biasedUnit(rand(seed + p.key + ':jy:v' + variant, 0)) * maxJY
    p.offX = parity * staggerX + jX
    p.offY = parity * staggerY + jY
  })

  // ── pass 2b: postits, deliberately aimed at a neighbor's actual box ──────
  // Regular jitter is capped (JITTER_MULT < 1) so an item can never leave its
  // own cell — by construction that means jitter alone can never even reach
  // the shared cell boundary, let alone cross into a neighbor's territory.
  // Postits are a fixed UI card, not a photo, and overlapping a neighboring
  // image (like a note pinned on top of a photo) is a designed accent, not a
  // jitter accident — so instead of jittering within its own cell, a postit
  // is aimed directly at a chosen image neighbor's already-known box,
  // crossing the boundary on purpose. The collision-resolution pass
  // afterward then pulls that back to exactly MAX_OVERLAP_FRAC.
  placed.forEach((p) => {
    if (!p.isPostit) return
    const parity = (p.row + p.col) % 2 === 0 ? 1 : -1
    const fallbackJX = Math.max(0, (cellW - p.w) / 2) * JITTER_MULT
    const fallbackJY = Math.max(0, (cellH - p.h) / 2) * JITTER_MULT

    type Candidate = { neighborIdx: number; dc: number; dr: number; wrapDx: number; wrapDy: number }
    const candidates: Candidate[] = []
    for (const [dc, dr] of NEIGHBOR_OFFSETS) {
      let nc = p.col + dc, nr = p.row + dr
      let wrapDx = 0, wrapDy = 0
      if (nc < 0) { nc += cols; wrapDx = -1 } else if (nc >= cols) { nc -= cols; wrapDx = 1 }
      if (nr < 0) { nr += rows; wrapDy = -1 } else if (nr >= rows) { nr -= rows; wrapDy = 1 }
      const neighborIdx = cellToPlacedIndex.get(nr * cols + nc)
      if (neighborIdx !== undefined && placed[neighborIdx].isImage) {
        candidates.push({ neighborIdx, dc, dr, wrapDx, wrapDy })
      }
    }

    if (candidates.length === 0) {
      const jX = biasedUnit(rand(seed + p.key + ':jx:v' + variant, 0)) * fallbackJX
      const jY = biasedUnit(rand(seed + p.key + ':jy:v' + variant, 0)) * fallbackJY
      p.offX = parity * staggerX + jX
      p.offY = parity * staggerY + jY
      return
    }

    const { neighborIdx, dc, dr, wrapDx, wrapDy } = candidates[Math.floor(rand(seed + p.key + ':target:v' + variant, 0) * candidates.length)]
    const neighbor = placed[neighborIdx]
    // Neighbor's already-finalized box (pass 2a ran for every non-postit
    // item), shifted by whichever tile copy this neighbor relationship
    // actually wraps to.
    const nCX = neighbor.baseCX + neighbor.offX + wrapDx * tileW
    const nCY = neighbor.baseCY + neighbor.offY + wrapDy * tileH

    // Aim to land the postit's center a quarter of the neighbor's own size
    // past its edge — comfortably inside its box — then let the resolution
    // pass trim that back to the allowed cap. On whichever axis isn't the
    // primary direction, align to the neighbor's actual center instead of
    // generic stagger — otherwise the neighbor's own jitter on that axis
    // could clear the postit's range entirely despite the primary-axis
    // crossing, and the two boxes would never truly intersect.
    p.offX = dc !== 0
      ? (nCX - dc * neighbor.w / 4) - p.baseCX
      : nCX - p.baseCX
    p.offY = dr !== 0
      ? (nCY - dr * neighbor.h / 4) - p.baseCY
      : nCY - p.baseCY
  })

  return { placed, cellToPlacedIndex }
}

// ── build & resolve all 4 variants together ───────────────────────────────
// Each tile only ever borders (via tileVariant's guarantee) a *different*
// variant than itself, so overlap resolution has to reach across variants
// at tile edges — it can't assume an edge cell's neighbor is more of the
// same layout, the way a single repeating tile would.
function buildAllLayouts(
  items: CanvasItemType[],
  seed: string,
  grid: { cols: number; rows: number; tileW: number; tileH: number },
  c: SizeConstants,
): Map<string, { x: number; y: number; w: number; h: number; itemKey: string }>[] {
  if (items.length === 0) return Array.from({ length: N_VARIANTS }, () => new Map())

  const { tileW, tileH } = grid

  const allPlaced: Placed[][] = []
  for (let v = 0; v < N_VARIANTS; v++) {
    const { placed } = placeVariant(items, v, seed, grid, c)
    allPlaced.push(placed)
  }

  const boxOf = (p: Placed, dx: number, dy: number) => {
    const cx = p.baseCX + p.offX * p.t + dx * tileW
    const cy = p.baseCY + p.offY * p.t + dy * tileH
    return { left: cx - p.w / 2, right: cx + p.w / 2, top: cy - p.h / 2, bottom: cy + p.h / 2 }
  }

  const overlapFrac = (a: Placed, b: Placed, dx: number, dy: number) => {
    const A = boxOf(a, 0, 0)
    const B = boxOf(b, dx, dy)
    const ow = Math.min(A.right, B.right) - Math.max(A.left, B.left)
    const oh = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top)
    if (ow <= 0 || oh <= 0) return 0
    const minArea = Math.min(a.w * a.h, b.w * b.h)
    return minArea > 0 ? (ow * oh) / minArea : 0
  }

  // The full region a box can occupy as its offset scales over t∈[0,1] — its
  // resting cell-center position (t=0) swept out to its full jittered/aimed
  // position (t=1). If two boxes' swept regions are disjoint they can never
  // overlap at any t, so this is the (necessary-condition) filter for whether
  // a pair is worth tracking as a constraint. Crucially it does NOT assume
  // overlap is monotonic in t: a postit aimed past a neighbor can sweep
  // *across* an intermediate item — touching it only at middle t values, not
  // at t=0 or t=1 — so a "do they overlap right now" filter would miss it.
  const sweptBox = (p: Placed, dx: number, dy: number) => {
    const cx0 = p.baseCX + dx * tileW, cy0 = p.baseCY + dy * tileH
    return {
      left: cx0 + Math.min(0, p.offX) - p.w / 2,
      right: cx0 + Math.max(0, p.offX) + p.w / 2,
      top: cy0 + Math.min(0, p.offY) - p.h / 2,
      bottom: cy0 + Math.max(0, p.offY) + p.h / 2,
    }
  }

  type Ref = { v: number; i: number }
  const ord = (r: Ref) => r.v * 1_000_000 + r.i
  const getPlaced = (r: Ref) => allPlaced[r.v][r.i]

  // Constraints are built from ACTUAL geometry, not grid-cell adjacency: a
  // postit is deliberately shoved across a cell boundary and can stick out
  // far enough to overlap an item whose home cell isn't adjacent to its own,
  // which a cell-adjacency graph would miss entirely. So for each variant
  // taken as the tile at offset (0,0), we render its full 3x3 tile
  // neighborhood (each surrounding tile at its correct flipped variant) and
  // record a constraint for every pair/triple of boxes whose swept regions
  // could ever overlap — the relative geometry of any (variantA item,
  // variantB item, tile offset) is identical in every rendered instance, so
  // resolving each distinct constraint once fixes the whole infinite plane.
  type NBox = { ref: Ref; dx: number; dy: number }

  const couldOverlap = (A: NBox, B: NBox) => {
    const a = sweptBox(getPlaced(A.ref), A.dx, A.dy)
    const b = sweptBox(getPlaced(B.ref), B.dx, B.dy)
    return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  }

  const neighborhood = (vc: number): { center: NBox[]; all: NBox[] } => {
    const center: NBox[] = allPlaced[vc].map((_, i) => ({ ref: { v: vc, i }, dx: 0, dy: 0 }))
    const all: NBox[] = [...center]
    for (const [dx, dy] of NEIGHBOR_OFFSETS) {
      const nv = neighborVariant(vc, dx, dy)
      allPlaced[nv].forEach((_, i) => all.push({ ref: { v: nv, i }, dx, dy }))
    }
    return { center, all }
  }

  type Pair = { a: Ref; b: Ref; dx: number; dy: number }
  const pairs: Pair[] = []
  const seenPairs = new Set<string>()

  type Triple = { refs: [Ref, Ref, Ref]; d: [number, number][] }
  const triples: Triple[] = []
  const seenTriples = new Set<string>()

  const canonPair = (A: NBox, B: NBox) => {
    // order by ref so the same physical pair from either center dedupes
    const [lo, hi, ddx, ddy] = ord(A.ref) < ord(B.ref)
      ? [A, B, B.dx - A.dx, B.dy - A.dy]
      : [B, A, A.dx - B.dx, A.dy - B.dy]
    return { a: lo.ref, b: hi.ref, dx: ddx, dy: ddy, key: `${ord(lo.ref)}:${ord(hi.ref)}:${ddx}:${ddy}` }
  }

  for (let vc = 0; vc < N_VARIANTS; vc++) {
    const { center, all } = neighborhood(vc)
    // pairs: every center box against every neighborhood box it could ever
    // overlap (over all t), not just those overlapping right now
    for (const A of center) {
      for (const B of all) {
        if (ord(A.ref) === ord(B.ref) && A.dx === B.dx && A.dy === B.dy) continue
        if (!couldOverlap(A, B)) continue
        const c = canonPair(A, B)
        if (seenPairs.has(c.key)) continue
        seenPairs.add(c.key)
        pairs.push({ a: c.a, b: c.b, dx: c.dx, dy: c.dy })
      }
    }
    // triples: any three mutually-overlapping boxes with at least one center
    const near = all.filter((B) =>
      center.some((A) =>
        !(ord(A.ref) === ord(B.ref) && A.dx === B.dx && A.dy === B.dy) &&
        couldOverlap(A, B)),
    )
    const pool = [...new Set([...center, ...near])]
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        for (let k = j + 1; k < pool.length; k++) {
          const t = [pool[i], pool[j], pool[k]]
          if (!t.some((b) => b.dx === 0 && b.dy === 0)) continue
          const keyRefs = t.map((b) => ord(b.ref))
          if (new Set(keyRefs).size < 3) continue
          const sorted = [...t].sort((a, b) => ord(a.ref) - ord(b.ref))
          const baseDx = sorted[0].dx, baseDy = sorted[0].dy
          const key = sorted.map((b) => `${ord(b.ref)}:${b.dx - baseDx}:${b.dy - baseDy}`).join('|')
          if (seenTriples.has(key)) continue
          seenTriples.add(key)
          triples.push({
            refs: [sorted[0].ref, sorted[1].ref, sorted[2].ref],
            d: sorted.map((b) => [b.dx - baseDx, b.dy - baseDy] as [number, number]),
          })
        }
      }
    }
  }

  const tripleOverlaps = (t: Triple) => {
    const [A, B, C] = t.refs.map((r, i) => boxOf(getPlaced(r), t.d[i][0], t.d[i][1]))
    const left = Math.max(A.left, B.left, C.left)
    const right = Math.min(A.right, B.right, C.right)
    const top = Math.max(A.top, B.top, C.top)
    const bottom = Math.min(A.bottom, B.bottom, C.bottom)
    return right > left && bottom > top
  }

  // Pull back (toward the plain unstaggered grid, where same-cell-sized
  // items can't overlap) any pair still over the cap, and eliminate any
  // 3-way overlap entirely (no more than two items may ever overlap at
  // once). A fixed-ratio decay step can overshoot straight past a narrow
  // "just under the cap" window when the starting overlap is large (e.g. a
  // postit deliberately aimed at a neighbor can start at ~100% overlap) and
  // land at 0% instead — so each violation is corrected with a bisection
  // search for the largest shared scale-down that satisfies it exactly,
  // rather than a blind multiplicative step.
  const scaleToSatisfy = (members: Placed[], violates: () => boolean) => {
    const bases = members.map((m) => m.t)
    let lo = 0, hi = 1
    for (let i = 0; i < 25; i++) {
      const mid = (lo + hi) / 2
      members.forEach((m, i2) => { m.t = bases[i2] * mid })
      if (violates()) hi = mid; else lo = mid
    }
    members.forEach((m, i2) => { m.t = bases[i2] * lo })
  }

  for (let iter = 0; iter < 40; iter++) {
    let changed = false
    for (const { a, b, dx, dy } of pairs) {
      const A = getPlaced(a), B = getPlaced(b)
      if (overlapFrac(A, B, dx, dy) > MAX_OVERLAP_FRAC) {
        scaleToSatisfy([A, B], () => overlapFrac(A, B, dx, dy) > MAX_OVERLAP_FRAC)
        changed = true
      }
    }
    for (const tr of triples) {
      if (tripleOverlaps(tr)) {
        scaleToSatisfy(tr.refs.map(getPlaced), () => tripleOverlaps(tr))
        changed = true
      }
    }
    if (!changed) break
  }

  // Cap how many neighbors a single item can simultaneously overlap at 1.
  // The checks above only forbid a single pair exceeding MAX_OVERLAP_FRAC or
  // a literal 3-way common intersection point — neither stops item B from
  // overlapping A on one side and C on the other (a "chain" where no single
  // point is shared by all three), which still reads as a cluster of 3+
  // overlapping tiles. Shrinking the offending item's own t toward its safe
  // t=0 cell center (not its neighbors') can only ever reduce — never
  // increase — how much it, or anyone measuring against it, overlaps, so
  // this can't undo the resolution above or introduce new violations.
  const adjacency = new Map<number, { other: Ref; dx: number; dy: number }[]>()
  const addEdge = (ref: Ref, other: Ref, dx: number, dy: number) => {
    const k = ord(ref)
    if (!adjacency.has(k)) adjacency.set(k, [])
    adjacency.get(k)!.push({ other, dx, dy })
  }
  for (const { a, b, dx, dy } of pairs) {
    addEdge(a, b, dx, dy)
    addEdge(b, a, -dx, -dy)
  }
  const refOf = new Map<number, Ref>()
  for (let v = 0; v < N_VARIANTS; v++) {
    allPlaced[v].forEach((_, i) => refOf.set(ord({ v, i }), { v, i }))
  }

  const overlapDegree = (ref: Ref) => {
    const P = getPlaced(ref)
    let count = 0
    for (const e of adjacency.get(ord(ref)) ?? []) {
      if (overlapFrac(P, getPlaced(e.other), e.dx, e.dy) > 0) count++
    }
    return count
  }

  for (let iter = 0; iter < 40; iter++) {
    let changed = false
    for (const k of adjacency.keys()) {
      const ref = refOf.get(k)!
      if (overlapDegree(ref) <= 1) continue
      const P = getPlaced(ref)
      const base = P.t
      let lo = 0, hi = base
      for (let i = 0; i < 25; i++) {
        const mid = (lo + hi) / 2
        P.t = mid
        if (overlapDegree(ref) > 1) hi = mid; else lo = mid
      }
      P.t = lo
      changed = true
    }
    if (!changed) break
  }

  return allPlaced.map((placed) => {
    const map = new Map<string, { x: number; y: number; w: number; h: number; itemKey: string }>()
    placed.forEach((p) => {
      map.set(p.key, {
        x: p.baseCX + p.offX * p.t - p.w / 2 - tileW / 2,
        y: p.baseCY + p.offY * p.t - p.h / 2 - tileH / 2,
        w: p.w,
        h: p.h,
        itemKey: p.itemKey,
      })
    })
    return map
  })
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
  const hasDragged  = useRef(false)
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
  // Panning must start regardless of what's under the cursor — including a
  // linked image or a video tile (autoplaying, no controls, so there's
  // nothing on it to protect) — or the canvas becomes undraggable everywhere
  // those happen to sit. `button` keeps its own direct interaction (nav
  // buttons), but a link only actually navigates via its click event, which
  // fires after mouseup — so a real drag (movement past DRAG_THRESHOLD) is
  // suppressed via onClickCapture below instead of by blocking the drag from
  // starting at all.
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    cancelAnim()
    isDragging.current = true
    hasDragged.current = false
    posBuf.current = []
    dragStart.current = {
      x: e.clientX, y: e.clientY,
      ox: offsetRef.current.x, oy: offsetRef.current.y,
    }
    e.preventDefault()
  }, [cancelAnim])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    if (Math.abs(e.clientX - dragStart.current.x) > DRAG_THRESHOLD || Math.abs(e.clientY - dragStart.current.y) > DRAG_THRESHOLD) {
      hasDragged.current = true
    }
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

  // A link's navigation happens on click, after mouseup — if the mousedown
  // that started it actually panned the canvas, cancel that click so
  // dragging across a linked image doesn't also navigate away.
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (hasDragged.current) {
      e.preventDefault()
      e.stopPropagation()
      hasDragged.current = false
    }
  }, [])

  // ── touch ─────────────────────────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    cancelAnim()
    isDragging.current = true
    hasDragged.current = false
    posBuf.current = []
    const t = e.touches[0]
    dragStart.current = {
      x: t.clientX, y: t.clientY,
      ox: offsetRef.current.x, oy: offsetRef.current.y,
    }
  }, [cancelAnim])

  const onTouchEnd = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    launchFling()
  }, [launchFling])

  // React attaches its synthetic touchmove listener as passive, so calling
  // preventDefault() through onTouchMove throws ("Unable to preventDefault
  // inside passive event listener invocation") on every drag frame on
  // mobile. Attach a native listener with passive: false instead, same as
  // the wheel handler below.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: TouchEvent) => {
      if (!isDragging.current) return
      const t = e.touches[0]
      if (Math.abs(t.clientX - dragStart.current.x) > DRAG_THRESHOLD || Math.abs(t.clientY - dragStart.current.y) > DRAG_THRESHOLD) {
        hasDragged.current = true
      }
      const now = performance.now()
      posBuf.current.push({ x: t.clientX, y: t.clientY, t: now })
      posBuf.current = posBuf.current.filter(p => now - p.t < 80)
      const x = dragStart.current.ox + (t.clientX - dragStart.current.x)
      const y = dragStart.current.oy + (t.clientY - dragStart.current.y)
      targetRef.current.x = x
      targetRef.current.y = y
      applyTransform(x, y)
      syncTiles()
      e.preventDefault()
    }
    el.addEventListener('touchmove', handler, { passive: false })
    return () => el.removeEventListener('touchmove', handler)
  }, [applyTransform, syncTiles])

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

  // Below MOBILE_BREAKPOINT, tiles render at MOBILE_SCALE — desktop keeps
  // DEFAULT_W untouched. Tracked as a boolean (not raw width) so the heavy
  // grid/layout rebuild below only reruns when crossing the breakpoint, not
  // on every resize tick (e.g. mobile browser chrome show/hide).
  const isMobile = viewSize.w < MOBILE_BREAKPOINT
  const sizeConstants = useMemo(() => computeSizeConstants(isMobile), [isMobile])

  // Grid dimensions (and so tile size) scale with item count so items always
  // render at full defaultW — rather than shrinking items to fit a
  // fixed-size tile, the tile grows to fit however many items there are.
  // Padded by CENTER_RESERVE_PAD_CELLS so there's always slack left over for
  // the center-text reservation in placeVariant.
  const grid = useMemo(
    () => computeTileGrid(items.length + CENTER_RESERVE_PAD_CELLS, sizeConstants),
    [items.length, sizeConstants]
  )

  const layouts = useMemo(
    () => seed !== null ? buildAllLayouts(items, seed, grid, sizeConstants) : [],
    [items, seed, grid, sizeConstants]
  )

  // A layout placement's key isn't always an item's own _key — a grid cell
  // left over with no item to fill it (see the "filler" pass in
  // placeVariant) gets a repeated item under a synthetic key — so look the
  // real item up by its itemKey rather than assuming placementKey === _key.
  const itemsByKey = useMemo(() => new Map(items.map((it) => [it._key, it])), [items])

  const tiles = visibleTiles(offset.x, offset.y, viewSize.w, viewSize.h, grid.tileW, grid.tileH)

  const displayText = locale === 'de' ? centerText?.de : (centerText?.en ?? centerText?.de)
  const lines = displayText?.split('\n') ?? []

  return (
    <div
      ref={containerRef}
      className="canvas-container fixed inset-0 overflow-hidden select-none bg-white"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onClickCapture={onClickCapture}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-10  mix-blend-difference text-white">
        <div className="text-center">
          <Link href={`/${locale}/projects`} className="inline-block pointer-events-auto">
            <span className="block font-build text-3xl leading-none">Studio</span>
            <span className="block font-build text-3xl font-medium leading-none">VIA</span>
          </Link>
            <div style={{ marginTop: 30 }}>
          <Link href={`/${locale}/projects`} className="inline-block pointer-events-auto">
              {lines.map((line, i) => (
                <span key={i} className="block font-build text-3xl leading-none">{line}</span>
              ))}
          </Link>
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
              {/* This pan layer (`innerRef`) is promoted to its own GPU
                  compositor layer by `willChange: transform` above, which
                  isolates mix-blend-mode descendants (e.g. photo credits)
                  from the true page background painted outside this layer —
                  they'd have nothing to blend against over an empty gap. A
                  plain white rect per tile, sitting below every item's
                  z-index, gives blend-mode content a real backdrop *inside*
                  this layer without covering any item (items always paint
                  above it) and without needing an opaque box on the
                  blend-mode element itself, which would hide neighbors it
                  happens to overlap. Overlapped into neighboring tiles by
                  BACKDROP_BLEED so a credit's spillover below its own cell
                  (its height isn't budgeted into the grid layout) always
                  lands on a painted backdrop instead of a seam between tiles. */}
              <div
                style={{
                  position: 'absolute',
                  left: tx * grid.tileW - BACKDROP_BLEED,
                  top: ty * grid.tileH - BACKDROP_BLEED,
                  width: grid.tileW + BACKDROP_BLEED * 2,
                  height: grid.tileH + BACKDROP_BLEED * 2,
                  background: 'white',
                }}
              />
              {Array.from(layout.entries()).map(([placementKey, pos]) => {
                const item = itemsByKey.get(pos.itemKey)
                if (!item) return null
                return (
                  <div
                    key={placementKey}
                    data-ci={placementKey}
                    data-cw={pos.w}
                    data-ch={pos.h}
                    style={{
                      position: 'absolute',
                      left:   pos.x + tx * grid.tileW,
                      top:    pos.y + ty * grid.tileH,
                      // Smaller items stack above larger ones, so an overlap
                      // never hides the smaller (usually more detailed) image.
                      // Subtracting (not dividing) preserves a distinct
                      // z-index for any two differently-sized items — an
                      // inverse via division rounds to the same integer for
                      // a wide range of large areas, causing z-index ties
                      // that fall back to (size-unrelated) DOM order.
                      // Postits always stack above every tile regardless of size.
                      zIndex: item._type === 'canvasPostit'
                        ? 2_000_000_000
                        : 1_000_000_000 - Math.round(pos.w * pos.h),
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
