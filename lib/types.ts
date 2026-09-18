export type Locale = 'de' | 'fr'

export interface LocalizedString {
  de?: string
  fr?: string
}

export interface SanityImageRef {
  asset: {
    _ref?: string
    url?: string
    _id?: string
    metadata?: { dimensions?: { width: number; height: number; aspectRatio: number } }
  }
  hotspot?: { x: number; y: number }
  crop?: { top?: number; bottom?: number; left?: number; right?: number }
}

export interface SanityFileRef {
  asset: {
    _ref?: string
    url?: string
    _id?: string
  }
}

export interface SanityColor {
  hex?: string
}

export interface CanvasItem {
  _key: string
  _type: 'canvasMedia' | 'canvasPostit'
  // media
  image?: SanityImageRef
  video?: SanityFileRef
  credit?: string
  // postit
  date?: string
  category?: string
  title?: { de?: unknown[]; fr?: unknown[] }
  backImage?: SanityImageRef
  backgroundColor?: SanityColor
  textColor?: SanityColor
  linkedProject?: { slug?: { current?: string } }
}

export interface HomepageData {
  centerText?: LocalizedString
  canvasItems?: CanvasItem[]
}

export interface Credit {
  _key: string
  text?: { de?: unknown[]; fr?: unknown[] }
}

export interface Slide {
  _key: string
  _type: 'mediaSlide' | 'textSlide'
  // media slide
  image?: SanityImageRef
  video?: SanityFileRef
  caption?: LocalizedString
  // text slide
  credits?: Credit[]
  description?: { de?: unknown[]; fr?: unknown[] }
}

export interface Project {
  _id: string
  title: LocalizedString
  slug: { current: string }
  year?: string
  location: LocalizedString
  information1?: LocalizedString
  information2?: LocalizedString
  information3?: LocalizedString
  thumbnail?: SanityImageRef
  thumbnailVideo?: SanityFileRef
  slides?: Slide[]
}

export interface StudioPageData {
  leftColumn?: { de?: unknown[]; fr?: unknown[] }
  rightColumn?: { de?: unknown[]; fr?: unknown[] }
  photo?: SanityImageRef
}

export interface AllProjectsYearGroup {
  year?: string
  projects?: Project[]
}

export interface AllProjectsPageData {
  years?: AllProjectsYearGroup[]
}
