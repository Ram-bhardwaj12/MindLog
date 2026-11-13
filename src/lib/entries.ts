import { entriesApi, ApiRequestError } from './api'
import type {
  EntryFontSize,
  EntryLineHeight,
  JournalEntry,
  MediaKind,
  MSWordFontKey
} from '../types'

export interface PendingMedia {
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

const MAX_ATTACHMENTS = 20
const MAX_UPLOAD_CHUNK = 5
const PURGE_CHUNK_SIZE = 200

const MAX_SIZE_BYTES = {
  image: 10 * 1024 * 1024, // 10 MB
  audio: 20 * 1024 * 1024, // 20 MB
  video: 50 * 1024 * 1024  // 50 MB
}

/**
 * Validates pending files against individual size limits and total attachment thresholds.
 */
function validatePendingFiles(pending: PendingMedia[]): void {
  for (const item of pending) {
    const file = item.file
    const name = file.name || 'File'

    if (file.type.startsWith('image/') || item.kind === 'image') {
      if (file.size > MAX_SIZE_BYTES.image) {
        throw new Error(`"${name}" is too large (max 10 MB for images)`)
      }
    } else if (file.type.startsWith('audio/') || item.kind === 'audio') {
      if (file.size > MAX_SIZE_BYTES.audio) {
        throw new Error(`"${name}" is too large (max 20 MB for audio)`)
      }
    } else if (file.type.startsWith('video/') || item.kind === 'video') {
      if (file.size > MAX_SIZE_BYTES.video) {
        throw new Error(`"${name}" is too large (max 50 MB for videos)`)
      }
    }
  }
}

/**
 * Loads all active and soft-deleted entries for the authenticated user, newest first.
 */
export async function fetchEntries(): Promise<JournalEntry[]> {
  const data = await entriesApi.list(true)
  return data.entries
}

/**
 * Uploads a single file to an entry and returns its public URL.
 * Preserved for backwards compatibility with existing consumers.
 */
export async function uploadMediaFile(entryId: string, file: File): Promise<string> {
  const formData = new FormData()
  formData.append('files', file, file.name)
  const data = await entriesApi.uploadMedia(entryId, formData)
  const uploaded = data.entry.media.find((m) => m.name === file.name)
  return uploaded ? uploaded.url : ''
}

/**
 * Creates a new journal entry, back-dated if specified, and uploads pending attachments in chunks of 5.
 * Rolls back the entry if any upload chunk fails.
 */
export async function createEntry(
  fields: EntryFields,
  pending: PendingMedia[],
  createdAt?: string
): Promise<JournalEntry> {
  // 1. Pre-validation before network calls
  if (pending.length > MAX_ATTACHMENTS) {
    throw new Error(`Cannot attach more than ${MAX_ATTACHMENTS} files (max ${MAX_ATTACHMENTS} attachments per entry)`)
  }
  validatePendingFiles(pending)

  // 2. Normalize back-dating date string to full ISO string
  // If YYYY-MM-DD format is provided, construct date at LOCAL NOON to prevent timezone boundary drift
  let isoCreatedAt: string | undefined
  if (createdAt) {
    const ymdMatch = createdAt.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (ymdMatch) {
      const year = Number(ymdMatch[1])
      const month = Number(ymdMatch[2])
      const day = Number(ymdMatch[3])
      const localNoon = new Date(year, month - 1, day, 12, 0, 0, 0)
      if (
        localNoon.getFullYear() !== year ||
        localNoon.getMonth() !== month - 1 ||
        localNoon.getDate() !== day
      ) {
        throw new Error(`Invalid calendar date: "${createdAt}" is not a real date`)
      }
      isoCreatedAt = localNoon.toISOString()
    } else {
      const parsed = new Date(createdAt)
      if (!isNaN(parsed.getTime())) {
        isoCreatedAt = parsed.toISOString()
      }
    }
  }

  // 3. Create entry document on backend
  const created = await entriesApi.create({
    ...fields,
    ...(isoCreatedAt ? { createdAt: isoCreatedAt } : {})
  })
  let currentEntry = created.entry

  // 4. Sequentially upload pending attachments in chunks of at most 5
  if (pending.length > 0) {
    try {
      for (let i = 0; i < pending.length; i += MAX_UPLOAD_CHUNK) {
        const chunk = pending.slice(i, i + MAX_UPLOAD_CHUNK)
        const formData = new FormData()
        for (const item of chunk) {
          formData.append('files', item.file, item.file.name)
        }
        const uploaded = await entriesApi.uploadMedia(currentEntry.id, formData)
        currentEntry = uploaded.entry
      }
    } catch (uploadError) {
      // Best-effort rollback: delete orphaned entry so retry does not duplicate
      try {
        await entriesApi.deleteEntry(currentEntry.id)
      } catch {
        // Suppress rollback cleanup errors and rethrow original upload error
      }
      throw uploadError
    }
  }

  return currentEntry
}

/**
 * Updates an existing entry's textual fields, removes deleted attachments, and uploads new files.
 */
export async function updateEntry(
  id: string,
  fields: EntryFields,
  pending: PendingMedia[],
  keptMediaIds: string[]
): Promise<JournalEntry> {
  // 1. Pre-validation: enforce combined total attachments cap and file sizes
  if (keptMediaIds.length + pending.length > MAX_ATTACHMENTS) {
    throw new Error(`An entry can have at most ${MAX_ATTACHMENTS} attachments total`)
  }
  validatePendingFiles(pending)

  // 2. Update entry textual fields (createdAt is intentionally omitted/immutable)
  const updated = await entriesApi.update(id, fields)
  let currentEntry = updated.entry

  // 3. Remove attachments that the user deleted in the editor
  const existingMedia = currentEntry.media || []
  const toRemove = existingMedia.filter((m) => !keptMediaIds.includes(m.id))
  for (const item of toRemove) {
    try {
      const result = await entriesApi.deleteMedia(id, item.id)
      currentEntry = result.entry
    } catch (err) {
      // Treat 404 as success (already removed on server) so retries succeed safely
      if (err instanceof ApiRequestError && err.status === 404) {
        continue
      }
      throw err
    }
  }

  // 4. Upload newly attached files in chunks of at most 5
  if (pending.length > 0) {
    for (let i = 0; i < pending.length; i += MAX_UPLOAD_CHUNK) {
      const chunk = pending.slice(i, i + MAX_UPLOAD_CHUNK)
      const formData = new FormData()
      for (const item of chunk) {
        formData.append('files', item.file, item.file.name)
      }
      const uploaded = await entriesApi.uploadMedia(id, formData)
      currentEntry = uploaded.entry
    }
  }

  return currentEntry
}

/**
 * Soft delete: moves an entry to the trash (preserves document and media).
 */
export async function softDeleteEntry(id: string): Promise<void> {
  await entriesApi.trash(id)
}

/**
 * Restores a soft-deleted entry back to active state.
 */
export async function restoreEntry(id: string): Promise<void> {
  await entriesApi.restore(id)
}

/**
 * Permanently deletes an entry along with all associated Cloudinary media.
 */
export async function permanentlyDeleteEntry(id: string): Promise<void> {
  await entriesApi.deleteEntry(id)
}

/**
 * Empties trash by purging entry IDs in batches of at most 200.
 */
export async function emptyTrash(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return

  for (let i = 0; i < ids.length; i += PURGE_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + PURGE_CHUNK_SIZE)
    await entriesApi.purgeTrash(chunk)
  }
}

/**
 * Updates bookmark status on an entry.
 */
export async function setBookmarked(id: string, bookmarked: boolean): Promise<void> {
  await entriesApi.setBookmark(id, bookmarked)
}
