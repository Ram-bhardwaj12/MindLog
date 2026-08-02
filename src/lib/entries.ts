import { supabase } from './supabase'
import type {
  EntryFontSize,
  EntryLineHeight,
  EntryMedia,
  JournalEntry,
  MediaKind,
  MSWordFontKey
} from '../types'

const BUCKET = 'journal-media'
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour

interface EntryRow {
  id: string
  title: string
  body_html: string
  created_at: string
  updated_at: string
  mood: string | null
  title_font_style: string | null
  font_style: string | null
  font_size: string | null
  line_height: string | null
  bookmarked: boolean
  deleted_at: string | null
}

interface MediaRow {
  id: string
  entry_id: string
  kind: MediaKind
  storage_path: string
  name: string
}

const ENTRY_COLUMNS =
  'id, title, body_html, created_at, updated_at, mood, title_font_style, font_style, font_size, line_height, bookmarked, deleted_at'

function rowToEntry(row: EntryRow, media: EntryMedia[]): JournalEntry {
  return {
    id: row.id,
    title: row.title,
    bodyHtml: row.body_html,
    media,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    mood: row.mood ?? undefined,
    titleFontStyle: (row.title_font_style as MSWordFontKey) ?? undefined,
    fontStyle: (row.font_style as MSWordFontKey) ?? undefined,
    fontSize: (row.font_size as EntryFontSize) ?? undefined,
    lineHeight: (row.line_height as EntryLineHeight) ?? undefined,
    bookmarked: row.bookmarked,
    deletedAt: row.deleted_at ?? undefined
  }
}

async function signMedia(rows: MediaRow[]): Promise<EntryMedia[]> {
  if (rows.length === 0) return []
  const paths = rows.map((r) => r.storage_path)
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
  if (error) throw error

  return rows.map((row, i) => ({
    id: row.id,
    kind: row.kind,
    name: row.name,
    url: data?.[i]?.signedUrl ?? ''
  }))
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw error ?? new Error('Not signed in')
  return data.user.id
}

/** Loads every entry (active AND trashed) with its media, signed for viewing. */
export async function fetchEntries(): Promise<JournalEntry[]> {
  const { data: entryRows, error: entryError } = await supabase
    .from('journal_entries')
    .select(ENTRY_COLUMNS)
    .order('created_at', { ascending: false })
  if (entryError) throw entryError

  const { data: mediaRows, error: mediaError } = await supabase
    .from('entry_media')
    .select('id, entry_id, kind, storage_path, name')
  if (mediaError) throw mediaError

  const signedMedia = await signMedia((mediaRows ?? []) as MediaRow[])
  const mediaByEntry = new Map<string, EntryMedia[]>()
  ;(mediaRows ?? []).forEach((row, i) => {
    const list = mediaByEntry.get(row.entry_id) ?? []
    list.push(signedMedia[i])
    mediaByEntry.set(row.entry_id, list)
  })

  return (entryRows as EntryRow[]).map((row) => rowToEntry(row, mediaByEntry.get(row.id) ?? []))
}

/** Uploads a single file to Storage under the current user's folder and returns its path. */
export async function uploadMediaFile(entryId: string, file: File): Promise<string> {
  const userId = await currentUserId()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${userId}/${entryId}/${crypto.randomUUID()}-${safeName}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
  if (error) throw error
  return path
}

interface PendingMedia {
  kind: MediaKind
  file: File
}

export interface EntryFields {
  title: string
  bodyHtml: string
  mood?: string
  titleFontStyle?: MSWordFontKey
  fontStyle?: MSWordFontKey
  fontSize?: EntryFontSize
  lineHeight?: EntryLineHeight
  bookmarked?: boolean
}

async function attachMedia(entryId: string, userId: string, pending: PendingMedia[]): Promise<EntryMedia[]> {
  if (pending.length === 0) return []

  const uploaded = await Promise.all(
    pending.map(async (p) => ({
      kind: p.kind,
      name: p.file.name,
      path: await uploadMediaFile(entryId, p.file)
    }))
  )

  const { data: inserted, error } = await supabase
    .from('entry_media')
    .insert(
      uploaded.map((u) => ({
        entry_id: entryId,
        user_id: userId,
        kind: u.kind,
        storage_path: u.path,
        name: u.name
      }))
    )
    .select('id, entry_id, kind, storage_path, name')
  if (error) throw error

  return signMedia(inserted as MediaRow[])
}

/** Creates a new entry (optionally back-dated, e.g. picked from the calendar). */
export async function createEntry(
  fields: EntryFields,
  pending: PendingMedia[],
  createdAt?: string
): Promise<JournalEntry> {
  const userId = await currentUserId()

  const { data: inserted, error: insertError } = await supabase
    .from('journal_entries')
    .insert({
      user_id: userId,
      title: fields.title,
      body_html: fields.bodyHtml,
      mood: fields.mood,
      title_font_style: fields.titleFontStyle,
      font_style: fields.fontStyle,
      font_size: fields.fontSize,
      line_height: fields.lineHeight,
      bookmarked: fields.bookmarked,
      ...(createdAt ? { created_at: createdAt } : {})
    })
    .select(ENTRY_COLUMNS)
    .single()
  if (insertError) throw insertError

  const row = inserted as EntryRow
  const media = await attachMedia(row.id, userId, pending)
  return rowToEntry(row, media)
}

/** Updates an existing entry's fields and uploads any newly attached files. */
export async function updateEntry(
  id: string,
  fields: EntryFields,
  pending: PendingMedia[],
  keptMediaIds: string[]
): Promise<JournalEntry> {
  const userId = await currentUserId()

  const { data: updated, error: updateError } = await supabase
    .from('journal_entries')
    .update({
      title: fields.title,
      body_html: fields.bodyHtml,
      mood: fields.mood,
      title_font_style: fields.titleFontStyle,
      font_style: fields.fontStyle,
      font_size: fields.fontSize,
      line_height: fields.lineHeight,
      bookmarked: fields.bookmarked
    })
    .eq('id', id)
    .select(ENTRY_COLUMNS)
    .single()
  if (updateError) throw updateError

  // Remove media the user deleted in the editor.
  const { data: existingMedia } = await supabase
    .from('entry_media')
    .select('id, storage_path')
    .eq('entry_id', id)
  const toRemove = (existingMedia ?? []).filter((m) => !keptMediaIds.includes(m.id))
  if (toRemove.length > 0) {
    await supabase.storage.from(BUCKET).remove(toRemove.map((m) => m.storage_path))
    await supabase
      .from('entry_media')
      .delete()
      .in('id', toRemove.map((m) => m.id))
  }

  const newMedia = await attachMedia(id, userId, pending)

  const { data: remainingRows } = await supabase
    .from('entry_media')
    .select('id, entry_id, kind, storage_path, name')
    .eq('entry_id', id)
    .in('id', keptMediaIds.length > 0 ? keptMediaIds : ['00000000-0000-0000-0000-000000000000'])
  const remainingSigned = await signMedia((remainingRows ?? []) as MediaRow[])

  const row = updated as EntryRow
  return rowToEntry(row, [...remainingSigned, ...newMedia])
}

/** Soft delete: moves an entry to the trash (keeps the row, media, and files). */
export async function softDeleteEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('journal_entries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Restores a soft-deleted entry back to the active list. */
export async function restoreEntry(id: string): Promise<void> {
  const { error } = await supabase.from('journal_entries').update({ deleted_at: null }).eq('id', id)
  if (error) throw error
}

/** Permanently deletes one entry, its media rows, and its files. */
export async function permanentlyDeleteEntry(id: string): Promise<void> {
  const { data: mediaRows } = await supabase.from('entry_media').select('storage_path').eq('entry_id', id)
  if (mediaRows && mediaRows.length > 0) {
    await supabase.storage.from(BUCKET).remove(mediaRows.map((m) => m.storage_path))
  }
  const { error } = await supabase.from('journal_entries').delete().eq('id', id)
  if (error) throw error
}

/** Permanently deletes every currently-trashed entry for the signed-in user. */
export async function emptyTrash(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => permanentlyDeleteEntry(id)))
}

/** Flips the bookmark flag on an entry. */
export async function setBookmarked(id: string, bookmarked: boolean): Promise<void> {
  const { error } = await supabase.from('journal_entries').update({ bookmarked }).eq('id', id)
  if (error) throw error
}
