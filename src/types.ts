export type MediaKind = 'image' | 'video' | 'audio'

export interface AuthUser {
  id: string
  email: string
  createdAt?: string
}

export interface EntryMedia {
  id: string
  kind: MediaKind
  url: string
  name: string
}

export type MSWordFontKey =
  | 'calibri'
  | 'georgia'
  | 'times'
  | 'garamond'
  | 'arial'
  | 'comic'
  | 'courier'
  | 'verdana'
  | 'trebuchet'
  | 'impact'
  | 'palatino'
  | 'bookman'
  | 'handwriting'
  | 'journal'
  | 'display'
  | 'body'

export type EntryFontSize = 'sm' | 'base' | 'lg' | 'xl'
export type EntryLineHeight = 'normal' | 'relaxed' | 'loose'

export interface JournalEntry {
  id: string
  title: string
  bodyHtml: string
  media: EntryMedia[]
  createdAt: string
  updatedAt: string
  mood?: string
  titleFontStyle?: MSWordFontKey
  fontStyle?: MSWordFontKey
  fontSize?: EntryFontSize
  lineHeight?: EntryLineHeight
  bookmarked?: boolean
  deletedAt?: string
}
