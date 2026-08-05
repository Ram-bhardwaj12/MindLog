import { useEffect, useRef, useState } from 'react'
import {
  X,
  Save,
  Trash2,
  Star,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  List,
  Image as ImageIcon,
  Video as VideoIcon,
  Mic,
  Loader2
} from 'lucide-react'
import type { EntryFontSize, EntryLineHeight, EntryMedia, JournalEntry, MediaKind } from '../types'
import { createEntry } from '../lib/entries'

export interface SavePayload {
  fields: {
    title: string
    bodyHtml: string
    titleFontStyle?: MSWordFontKey
    fontStyle?: MSWordFontKey
    fontSize?: EntryFontSize
    lineHeight?: EntryLineHeight
    bookmarked?: boolean
  }
  pending: { kind: MediaKind; file: File }[]
  keptMediaIds: string[]
}

interface Props {
  entry: JournalEntry | null
  onClose: () => void
  onSave: (payload: SavePayload) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

interface PendingFile {
  tempId: string
  kind: MediaKind
  file: File
  previewUrl: string
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
  | 'journal'
  | 'handwriting'
  | 'display'
  | 'body'

export const MS_WORD_FONTS: { id: MSWordFontKey; name: string }[] = [
  { id: 'calibri', name: 'SF Pro / System Sans' },
  { id: 'georgia', name: 'Georgia (Serif)' },
  { id: 'times', name: 'Times New Roman' },
  { id: 'garamond', name: 'Garamond (Book)' },
  { id: 'arial', name: 'Arial (Clean)' },
  { id: 'comic', name: 'Comic Sans MS' },
  { id: 'courier', name: 'Courier New' },
  { id: 'verdana', name: 'Verdana (Sans)' },
  { id: 'journal', name: 'Lora (Journal)' },
  { id: 'handwriting', name: 'Caveat (Handwritten)' },
  { id: 'display', name: 'Fraunces (Display)' },
  { id: 'body', name: 'Work Sans' }
]

export const FONT_FAMILY_MAP: Record<MSWordFontKey, string> = {
  calibri: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
  georgia: "Georgia, 'Times New Roman', serif",
  times: "'Times New Roman', Times, serif",
  garamond: "'EB Garamond', Garamond, Georgia, serif",
  arial: "Arial, Helvetica, sans-serif",
  comic: "'Comic Neue', 'Comic Sans MS', cursive, sans-serif",
  courier: "'Courier Prime', 'Courier New', monospace",
  verdana: "Verdana, Geneva, sans-serif",
  trebuchet: "'Trebuchet MS', Helvetica, sans-serif",
  impact: "Impact, Charcoal, sans-serif",
  palatino: "'Palatino Linotype', Palatino, serif",
  bookman: "'Bookman Old Style', Bookman, serif",
  journal: "'Lora', Georgia, serif",
  handwriting: "'Caveat', cursive, sans-serif",
  display: "'Fraunces', Georgia, serif",
  body: "'Work Sans', sans-serif"
}

function acceptFor(kind: MediaKind) {
  if (kind === 'image') return 'image/*'
  if (kind === 'video') return 'video/*'
  return 'audio/*'
}

export function EntryEditor({ entry, onClose, onSave, onDelete }: Props) {
  const isNew = entry === null
  const [title, setTitle] = useState(entry?.title ?? '')

  // Focus tracking state: true when cursor is inside Title input or Body editor box
  const [isTextEditingFocused, setIsTextEditingFocused] = useState(false)

  // Last focused active input section ('title' vs 'body')
  const [lastFocusedElement, setLastFocusedElement] = useState<'title' | 'body'>('title')

  // Dynamic Title Formatting States
  const [isTitleBold, setIsTitleBold] = useState(false)
  const [isTitleItalic, setIsTitleItalic] = useState(false)
  const [isTitleUnderline, setIsTitleUnderline] = useState(false)

  const [titleFontStyle, setTitleFontStyle] = useState<MSWordFontKey>(entry?.titleFontStyle ?? 'journal')
  const [fontStyle, setFontStyle] = useState<MSWordFontKey>(entry?.fontStyle ?? 'calibri')
  const [fontSize, setFontSize] = useState<EntryFontSize>(entry?.fontSize ?? 'base')
  const [lineHeight, setLineHeight] = useState<EntryLineHeight>(entry?.lineHeight ?? 'relaxed')
  const [bookmarked, setBookmarked] = useState<boolean>(entry?.bookmarked ?? false)
  const [existingMedia, setExistingMedia] = useState<EntryMedia[]>(entry?.media ?? [])
  const [pendingMedia, setPendingMedia] = useState<PendingFile[]>([])

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [wordCount, setWordCount] = useState(0)
  const [charCount, setCharCount] = useState(0)

  const [activeFormat, setActiveFormat] = useState({
    bold: false,
    italic: false,
    underline: false,
    justifyLeft: true,
    justifyCenter: false,
    bulletList: false
  })

  const titleRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const fileInputs = {
    image: useRef<HTMLInputElement>(null),
    video: useRef<HTMLInputElement>(null),
    audio: useRef<HTMLInputElement>(null)
  }

  const updateActiveFormatting = () => {
    try {
      const isBold = document.queryCommandState('bold')
      const isItalic = document.queryCommandState('italic')
      const isUnderline = document.queryCommandState('underline')
      const isCenter = document.queryCommandState('justifyCenter')
      const isLeft = document.queryCommandState('justifyLeft') || (!isCenter && !document.queryCommandState('justifyRight'))
      const isList = document.queryCommandState('insertUnorderedList')

      setActiveFormat({
        bold: isBold,
        italic: isItalic,
        underline: isUnderline,
        justifyLeft: isLeft,
        justifyCenter: isCenter,
        bulletList: isList
      })
    } catch {
      // Ignore formatting state query errors if contentEditable is unfocused
    }
  }

  const executeCmd = (command: string, value: string | undefined = undefined) => {
    if (!bodyRef.current) return
    bodyRef.current.focus()
    document.execCommand(command, false, value)
    updateActiveFormatting()
    updateCounts()
  }

  // Handle formatting toggle without shifting focus
  const handleToggleBold = (e: React.MouseEvent) => {
    e.preventDefault()
    if (lastFocusedElement === 'title') {
      setIsTitleBold(!isTitleBold)
    } else {
      executeCmd('bold')
    }
  }

  const handleToggleItalic = (e: React.MouseEvent) => {
    e.preventDefault()
    if (lastFocusedElement === 'title') {
      setIsTitleItalic(!isTitleItalic)
    } else {
      executeCmd('italic')
    }
  }

  const handleToggleUnderline = (e: React.MouseEvent) => {
    e.preventDefault()
    if (lastFocusedElement === 'title') {
      setIsTitleUnderline(!isTitleUnderline)
    } else {
      executeCmd('underline')
    }
  }

  const updateCounts = () => {
    if (!bodyRef.current) return
    const text = bodyRef.current.textContent || bodyRef.current.innerText || ''
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    setWordCount(words)
    setCharCount(text.length)
  }

  useEffect(() => {
    updateCounts()
  }, [])

  useEffect(() => {
    if (bodyRef.current) {
      const fontCss = FONT_FAMILY_MAP[fontStyle] || FONT_FAMILY_MAP.calibri
      bodyRef.current.style.setProperty('--entry-body-font', fontCss)
      bodyRef.current.style.fontFamily = fontCss
    }
  }, [fontStyle])

  const handleAttach = (kind: MediaKind, files: FileList | null) => {
    if (!files || files.length === 0) return
    const next: PendingFile[] = Array.from(files).map((file) => ({
      tempId: crypto.randomUUID(),
      kind,
      file,
      previewUrl: URL.createObjectURL(file)
    }))
    setPendingMedia((prev) => [...prev, ...next])
  }

  const removeExisting = (id: string) => setExistingMedia((prev) => prev.filter((m) => m.id !== id))
  const removePending = (tempId: string) => setPendingMedia((prev) => prev.filter((m) => m.tempId !== tempId))

  const handleSave = async () => {
    if (saving || deleting) return
    setError(null)
    setSaving(true)
    const bodyHtml = bodyRef.current?.innerHTML ?? ''

    try {
      await onSave({
        fields: {
          title: title.trim() || 'Untitled Entry',
          bodyHtml,
          titleFontStyle,
          fontStyle,
          fontSize,
          lineHeight,
          bookmarked
        },
        pending: pendingMedia.map((p) => ({ kind: p.kind, file: p.file })),
        keptMediaIds: existingMedia.map((m) => m.id)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this entry. Please try again.')
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!entry || !onDelete) return
    setError(null)
    setDeleting(true)
    try {
      await onDelete(entry.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete entry.')
      setDeleting(false)
    }
  }

  const sizeClass =
    fontSize === 'sm' ? 'text-sm' : fontSize === 'lg' ? 'text-lg' : fontSize === 'xl' ? 'text-xl' : 'text-base'

  const leadingClass =
    lineHeight === 'loose' ? 'leading-loose' : lineHeight === 'normal' ? 'leading-normal' : 'leading-relaxed'

  // Active toolbar indicator states
  const isBoldActive = lastFocusedElement === 'title' ? isTitleBold : activeFormat.bold
  const isItalicActive = lastFocusedElement === 'title' ? isTitleItalic : activeFormat.italic
  const isUnderlineActive = lastFocusedElement === 'title' ? isTitleUnderline : activeFormat.underline

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isTextEditingFocused) {
          e.preventDefault()
          handleSave()
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-0 sm:p-6 backdrop-blur-md transition-opacity duration-200 animate-in fade-in pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="flex h-[100dvh] sm:h-[92vh] max-h-[100dvh] w-full max-w-5xl flex-col rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 bg-white shadow-2xl overflow-hidden text-slate-900 animate-in zoom-in-95 slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-200 ease-out">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-5 sm:px-8 py-4 sm:py-5">
          <div className="flex items-center gap-4">
            <h2 className="font-black text-xl sm:text-2xl text-slate-900 tracking-tight">
              {isNew ? 'New Journal Entry' : 'Edit Journal Entry'}
            </h2>

            {/* Bookmark Button */}
            <button
              onClick={() => setBookmarked(!bookmarked)}
              className={`group flex items-center gap-2 rounded-2xl px-4 py-2 text-xs sm:text-sm font-extrabold transition-all cursor-pointer shadow-2xs border ${
                bookmarked
                  ? 'border-amber-300 bg-amber-100 text-[#FF9500] shadow-xs'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-amber-300 hover:text-slate-900'
              }`}
              title={bookmarked ? 'Remove Bookmark' : 'Add to Bookmarks'}
            >
              <Star
                className={`h-4 w-4 transition-transform group-hover:scale-110 ${
                  bookmarked ? 'fill-[#FF9500] text-[#FF9500]' : 'text-slate-500'
                }`}
              />
              <span>{bookmarked ? 'Bookmarked' : 'Bookmark'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {!isNew && onDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting || saving}
                className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-[#FF3B30] transition hover:bg-[#FF3B30] hover:text-white disabled:opacity-50 cursor-pointer shadow-xs active:scale-95"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 text-current animate-spin shrink-0" />
                ) : (
                  <Trash2 className="h-4 w-4 text-current shrink-0" />
                )}
                <span className="hidden sm:inline">{deleting ? 'Deleting…' : 'Delete'}</span>
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={saving || deleting}
              className="flex items-center gap-2 rounded-2xl bg-[#007AFF] px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-md transition hover:bg-blue-600 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 text-white animate-spin shrink-0" />
              ) : (
                <Save className="h-4 w-4 text-white shrink-0" />
              )}
              <span>{saving ? 'Saving…' : 'Save Entry'}</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-2xl p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 cursor-pointer"
            >
              <X className="h-5 w-5 text-current" />
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 px-6 py-3 text-xs sm:text-sm font-extrabold text-[#FF3B30] border-b border-red-200">
            {error}
          </div>
        )}

        {/* Top Control Bar: Formatting + Media Attachment Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3.5 border-b border-slate-200 bg-slate-50/50 px-5 sm:px-8 py-3.5 text-sm">
          <div className="flex flex-wrap items-center gap-3.5">
            {/* Title Font Selector */}
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-600 text-xs sm:text-sm">Title Font:</span>
              <select
                value={titleFontStyle}
                onChange={(e) => setTitleFontStyle(e.target.value as MSWordFontKey)}
                className="rounded-2xl border border-slate-300 bg-white py-1.5 px-3 text-xs sm:text-sm font-extrabold text-slate-900 outline-none transition focus:border-[#007AFF] cursor-pointer shadow-2xs"
              >
                {MS_WORD_FONTS.map((f) => (
                  <option key={f.id} value={f.id} className="bg-white text-slate-900 font-semibold py-1">
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Body Font Selector */}
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-600 text-xs sm:text-sm">Body Font:</span>
              <select
                value={fontStyle}
                onChange={(e) => setFontStyle(e.target.value as MSWordFontKey)}
                className="rounded-2xl border border-slate-300 bg-white py-1.5 px-3 text-xs sm:text-sm font-extrabold text-slate-900 outline-none transition focus:border-[#007AFF] cursor-pointer shadow-2xs"
              >
                {MS_WORD_FONTS.map((f) => (
                  <option key={f.id} value={f.id} className="bg-white text-slate-900 font-semibold py-1">
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Font Size Selector */}
            <select
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value as EntryFontSize)}
              className="rounded-2xl border border-slate-300 bg-white py-1.5 px-3 text-xs sm:text-sm font-extrabold text-slate-900 outline-none transition focus:border-[#007AFF] cursor-pointer shadow-2xs"
            >
              <option value="sm">Small</option>
              <option value="base">Normal</option>
              <option value="lg">Large</option>
              <option value="xl">Huge</option>
            </select>

            <span className="h-5 w-px bg-slate-300" />

            {/* Typography Formatting Actions */}
            <div className="flex items-center gap-1 rounded-2xl border border-slate-300 bg-white p-1 shadow-2xs">
              <button
                type="button"
                onMouseDown={handleToggleBold}
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all cursor-pointer ${
                  isBoldActive
                    ? 'bg-[#007AFF] text-white font-extrabold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                }`}
                title="Bold"
              >
                <Bold className="h-4 w-4 text-current" />
              </button>

              <button
                type="button"
                onMouseDown={handleToggleItalic}
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all cursor-pointer ${
                  isItalicActive
                    ? 'bg-[#007AFF] text-white font-extrabold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                }`}
                title="Italic"
              >
                <Italic className="h-4 w-4 text-current" />
              </button>

              <button
                type="button"
                onMouseDown={handleToggleUnderline}
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all cursor-pointer ${
                  isUnderlineActive
                    ? 'bg-[#007AFF] text-white font-extrabold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                }`}
                title="Underline"
              >
                <Underline className="h-4 w-4 text-current" />
              </button>

              <span className="h-4 w-px bg-slate-300 mx-0.5" />

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  executeCmd('justifyLeft')
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all cursor-pointer ${
                  activeFormat.justifyLeft
                    ? 'bg-[#007AFF] text-white font-extrabold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                }`}
                title="Align Left"
              >
                <AlignLeft className="h-4 w-4 text-current" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  executeCmd('justifyCenter')
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all cursor-pointer ${
                  activeFormat.justifyCenter
                    ? 'bg-[#007AFF] text-white font-extrabold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                }`}
                title="Align Center"
              >
                <AlignCenter className="h-4 w-4 text-current" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  executeCmd('insertUnorderedList')
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all cursor-pointer ${
                  activeFormat.bulletList
                    ? 'bg-[#007AFF] text-white font-extrabold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                }`}
                title="Bullet List"
              >
                <List className="h-4 w-4 text-current" />
              </button>
            </div>
          </div>

          {/* Media Attachment Buttons at Top Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputs.image.current?.click()}
              className="flex items-center gap-1.5 rounded-2xl border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-extrabold text-slate-800 transition hover:bg-slate-100 hover:text-[#007AFF] cursor-pointer shadow-2xs"
            >
              <ImageIcon className="h-4 w-4 text-[#007AFF]" />
              <span>+ Image</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputs.video.current?.click()}
              className="flex items-center gap-1.5 rounded-2xl border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-extrabold text-slate-800 transition hover:bg-slate-100 hover:text-[#007AFF] cursor-pointer shadow-2xs"
            >
              <VideoIcon className="h-4 w-4 text-[#007AFF]" />
              <span>+ Video</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputs.audio.current?.click()}
              className="flex items-center gap-1.5 rounded-2xl border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-extrabold text-slate-800 transition hover:bg-slate-100 hover:text-[#007AFF] cursor-pointer shadow-2xs"
            >
              <Mic className="h-4 w-4 text-[#007AFF]" />
              <span>+ Audio</span>
            </button>

            <div className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200 ml-1">
              {wordCount}w · {charCount}c
            </div>
          </div>

          {/* Hidden File Inputs */}
          <input
            ref={fileInputs.image}
            type="file"
            accept={acceptFor('image')}
            multiple
            className="hidden"
            onChange={(e) => handleAttach('image', e.target.files)}
          />
          <input
            ref={fileInputs.video}
            type="file"
            accept={acceptFor('video')}
            multiple
            className="hidden"
            onChange={(e) => handleAttach('video', e.target.files)}
          />
          <input
            ref={fileInputs.audio}
            type="file"
            accept={acceptFor('audio')}
            multiple
            className="hidden"
            onChange={(e) => handleAttach('audio', e.target.files)}
          />
        </div>

        {/* Main Document Content Canvas */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 sm:px-10 py-6 sm:py-8 bg-white">
          {/* Document Title Input */}
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => {
              setLastFocusedElement('title')
              setIsTextEditingFocused(true)
            }}
            onBlur={() => setIsTextEditingFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                setIsTextEditingFocused(true)
                bodyRef.current?.focus()
              }
            }}
            placeholder="Document Title…"
            style={{ fontFamily: FONT_FAMILY_MAP[titleFontStyle] || FONT_FAMILY_MAP.journal }}
            className={`w-full bg-transparent text-2xl sm:text-4xl text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 border-b border-transparent focus:border-slate-300 pb-2 ${
              isTitleBold ? 'font-black' : 'font-semibold'
            } ${isTitleItalic ? 'italic' : 'not-italic'} ${isTitleUnderline ? 'underline' : 'no-underline'}`}
          />

          {/* Attached Media Items Grid */}
          {(existingMedia.length > 0 || pendingMedia.length > 0) && (
            <div className="flex flex-wrap gap-3.5 py-2 border-b border-slate-200 pb-4">
              {existingMedia.map((m) => (
                <div key={m.id} className="relative group rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-2xs">
                  {m.kind === 'image' && (
                    <img src={m.url} alt={m.name} className="h-24 w-32 rounded-xl object-cover" />
                  )}
                  {m.kind === 'video' && (
                    <video src={m.url} className="h-24 w-32 rounded-xl object-cover" controls />
                  )}
                  {m.kind === 'audio' && (
                    <div className="flex h-24 w-32 flex-col items-center justify-center p-2 text-center text-xs">
                      <Mic className="h-6 w-6 text-[#007AFF]" />
                      <span className="mt-1 truncate text-xs font-semibold text-slate-800">{m.name}</span>
                    </div>
                  )}
                  <button
                    onClick={() => removeExisting(m.id)}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#FF3B30] text-white shadow-md hover:bg-red-600 cursor-pointer"
                    title="Remove attachment"
                  >
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              ))}

              {pendingMedia.map((p) => (
                <div key={p.tempId} className="relative group rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-2xs">
                  {p.kind === 'image' && (
                    <img src={p.previewUrl} alt={p.file.name} className="h-24 w-32 rounded-xl object-cover" />
                  )}
                  {p.kind === 'video' && (
                    <video src={p.previewUrl} className="h-24 w-32 rounded-xl object-cover" controls />
                  )}
                  {p.kind === 'audio' && (
                    <div className="flex h-24 w-32 flex-col items-center justify-center p-2 text-center text-xs">
                      <Mic className="h-6 w-6 text-[#007AFF]" />
                      <span className="mt-1 truncate text-xs font-semibold text-slate-800">{p.file.name}</span>
                    </div>
                  )}
                  <button
                    onClick={() => removePending(p.tempId)}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#FF3B30] text-white shadow-md hover:bg-red-600 cursor-pointer"
                    title="Remove attachment"
                  >
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Content Editable Writing Area */}
          <div
            ref={bodyRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => {
              updateCounts()
              updateActiveFormatting()
            }}
            onKeyUp={updateActiveFormatting}
            onClick={updateActiveFormatting}
            onFocus={() => {
              setLastFocusedElement('body')
              setIsTextEditingFocused(true)
              updateActiveFormatting()
            }}
            onBlur={() => setIsTextEditingFocused(false)}
            dangerouslySetInnerHTML={{ __html: entry?.bodyHtml ?? '' }}
            style={
              {
                '--entry-body-font': FONT_FAMILY_MAP[fontStyle] || FONT_FAMILY_MAP.calibri,
                fontFamily: FONT_FAMILY_MAP[fontStyle] || FONT_FAMILY_MAP.calibri
              } as React.CSSProperties
            }
            className={`entry-body-content min-h-[360px] w-full rounded-2xl border border-transparent px-3 py-3 text-slate-900 outline-none transition-all duration-200 focus:border-slate-200 ${sizeClass} ${leadingClass}`}
            data-placeholder="Write your thoughts here…"
          />
        </div>

        {/* Bottom Sticky Action Bar */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/90 px-5 sm:px-8 py-3 shrink-0">
          <div className="text-xs font-extrabold text-slate-600 flex items-center gap-3">
            <span>Words: <strong className="text-slate-900 font-black">{wordCount}</strong></span>
            <span>Chars: <strong className="text-slate-900 font-black">{charCount}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100 transition cursor-pointer shadow-2xs"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || deleting}
              className="flex items-center gap-2 rounded-2xl bg-[#007AFF] px-5 py-2 text-xs sm:text-sm font-black text-white shadow-md transition hover:bg-blue-600 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 text-white animate-spin shrink-0" />
              ) : (
                <Save className="h-4 w-4 text-white shrink-0" />
              )}
              <span>{saving ? 'Saving…' : 'Save Entry'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
