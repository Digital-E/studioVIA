export type Locale = 'de' | 'en'

export interface LocalizedString {
  de?: string
  en?: string
}

export interface SanityImageRef {
  asset: { _ref?: string; url?: string; _id?: string }
  hotspot?: { x: number; y: number }
  crop?: object
}

export interface CanvasItem {
  _key: string
  _type: 'canvasMedia' | 'canvasPostit'
  // media
  mediaType?: 'image' | 'video'
  image?: SanityImageRef
  videoUrl?: string
  credit?: string
  // postit
  date?: string
  category?: string
  title?: { de?: unknown[]; en?: unknown[] }
  backImage?: SanityImageRef
}

export interface HomepageData {
  centerText?: LocalizedString
  canvasItems?: CanvasItem[]
}

export interface Credit {
  _key: string
  label: string
  value: string
}

export interface Slide {
  _key: string
  _type: 'mediaSlide' | 'textSlide'
  // media slide
  slideType?: 'image' | 'video'
  image?: SanityImageRef
  videoUrl?: string
  caption?: LocalizedString
  // text slide
  credits?: Credit[]
  description?: { de?: unknown[]; en?: unknown[] }
}

export interface Project {
  _id: string
  title: LocalizedString
  slug: { current: string }
  year: number
  location: LocalizedString
  prize?: LocalizedString
  thumbnail?: SanityImageRef
  isGrayed?: boolean
  slides?: Slide[]
}

export interface TeamMember {
  _key: string
  name: string
  degree?: string
  bio?: LocalizedString
}

export interface ContactInfo {
  address?: string
  email?: string
  phone?: string
  foundingYear?: string
  legalForm?: string
  uid?: string
  mwst?: string
}

export interface StudioPageData {
  projektText?: { de?: unknown[]; en?: unknown[] }
  teamMembers?: TeamMember[]
  contactInfo?: ContactInfo
  legalText?: { de?: unknown[]; en?: unknown[] }
  photo?: SanityImageRef
}
