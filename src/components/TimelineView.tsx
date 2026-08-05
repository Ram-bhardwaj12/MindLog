import { useMemo, useState } from 'react'
import {
  Search,
  Star,
  Copy,
  Check,
  Edit3,
  Trash2,
  Calendar,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BookOpen
} from 'lucide-react'
import type { JournalEntry } from '../types'
import { FONT_FAMILY_MAP } from './EntryEditor'

interface TimelineViewProps {
  entries: JournalEntry[]
  onOpenEntry: (entry: JournalEntry) => void
  onToggleBookmark: (entry: JournalEntry) => void
  onSoftDelete: (entry: JournalEntry) => void
  onNewEntry: () => void
}

type TimelineFilter = 'all' | 'bookmarked'

function stripHtml(html: string) {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

export function TimelineView({
  entries,
  onOpenEntry,
  onToggleBookmark,
  onSoftDelete,
  onNewEntry
}: TimelineViewProps) {
  const [filter, setFilter] = useState<TimelineFilter>('all')
  const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (filter === 'bookmarked' && !e.bookmarked) return false
      return true
    })
  }, [entries, filter])

  // Group entries by Month Year
  const groupedEntries = useMemo(() => {
    const map = new Map<string, JournalEntry[]>()
    filteredEntries.forEach((entry) => {
      const date = new Date(entry.createdAt)
      const monthYear = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      const list = map.get(monthYear) || []
      list.push(entry)
      map.set(monthYear, list)
    })
    return Array.from(map.entries())
  }, [filteredEntries])

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedEntries((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleCopy = (entry: JournalEntry, e: React.MouseEvent) => {
    e.stopPropagation()
    const text = `${entry.title}\n\n${stripHtml(entry.bodyHtml)}`
    navigator.clipboard.writeText(text)
    setCopiedId(entry.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Top Control Header */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#007AFF] shadow-2xs">
            <BookOpen className="w-5 h-5 stroke-[2.4] text-[#007AFF]" />
          </div>
          <div>
            <h2 className="font-extrabold text-xl sm:text-2xl text-slate-900 tracking-tight">
              Memory Feed
            </h2>
            <p className="text-xs font-bold text-slate-600">
              {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'} in your diary feed
            </p>
          </div>
        </div>

        {/* Compact Dropdown Filter */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">Filter:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as TimelineFilter)}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-extrabold text-[#007AFF] outline-none transition focus:border-[#007AFF] cursor-pointer shadow-2xs"
          >
            <option value="all" className="bg-white text-slate-900 font-semibold py-1">All Memories</option>
            <option value="bookmarked" className="bg-white text-slate-900 font-semibold py-1">Bookmarked ⭐</option>
          </select>
        </div>
      </div>

      {/* Main Timeline Stream */}
      {groupedEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 sm:p-14 text-center shadow-xs animate-in fade-in duration-200">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50/80 text-[#007AFF] mb-4 ring-8 ring-blue-50/40">
            <Sparkles className="w-10 h-10 stroke-[2] text-[#007AFF]" />
          </div>
          <h3 className="font-black text-xl sm:text-2xl text-slate-900 tracking-tight">No memories found</h3>
          <p className="mt-2 text-xs sm:text-sm font-semibold text-slate-600 max-w-md leading-relaxed">
            {filter === 'bookmarked'
              ? "You haven't bookmarked any journal pages yet. Star your favorite entries to see them here!"
              : 'Your memory feed is empty. Capture your daily thoughts, reflections, and highlights today!'}
          </p>
          <button
            onClick={onNewEntry}
            className="mt-6 rounded-2xl bg-[#007AFF] px-6 py-3 text-xs sm:text-sm font-black text-white transition hover:bg-blue-600 active:scale-95 shadow-md shadow-blue-500/20 cursor-pointer"
          >
            + Write First Entry
          </button>
        </div>
      ) : (
        <div className="relative space-y-10 before:absolute before:left-4 sm:before:left-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-300">
          {groupedEntries.map(([monthYear, monthEntries]) => (
            <div key={monthYear} className="relative space-y-5">
              {/* Month Divider Badge */}
              <div className="sticky top-20 z-10 flex items-center gap-3 pl-2 sm:pl-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#007AFF] text-white shadow-sm ring-4 ring-white">
                  <Calendar className="w-3 h-3 text-white" />
                </div>
                <span className="rounded-full border border-slate-300 bg-white px-4 py-1 text-xs font-extrabold text-slate-900 shadow-xs">
                  {monthYear}
                </span>
              </div>

              {/* Group Entries List */}
              <div className="space-y-4 pl-9 sm:pl-14">
                {monthEntries.map((entry) => {
                  const plainText = stripHtml(entry.bodyHtml)
                  const isExpanded = !!expandedEntries[entry.id]
                  const previewText = plainText.slice(0, 160)
                  const images = entry.media.filter((m) => m.kind === 'image')

                  const dateObj = new Date(entry.createdAt)
                  const dayNum = dateObj.getDate()
                  const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'short' })
                  const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

                  return (
                    <div
                      key={entry.id}
                      className="group relative rounded-3xl border border-slate-200 bg-white ios-card-interactive p-6 sm:p-7 shadow-sm hover:border-[#007AFF]"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-2">
                          {/* Date and Time Subheader */}
                          <div className="flex items-center gap-2.5 text-xs font-extrabold text-[#007AFF]">
                            <span className="rounded-full bg-blue-50 border border-blue-100 px-3 py-0.5 text-[#007AFF] font-extrabold">
                              {dayName}, {monthYear.split(' ')[0]} {dayNum}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-500 font-mono text-[11px] font-bold">{timeStr}</span>
                          </div>

                          {/* Title */}
                          <h3
                            style={{ fontFamily: FONT_FAMILY_MAP[entry.titleFontStyle || 'display'] }}
                            onClick={() => onOpenEntry(entry)}
                            className="text-xl sm:text-2xl font-black text-slate-900 transition hover:text-[#007AFF] cursor-pointer tracking-tight"
                          >
                            {entry.title}
                          </h3>

                          {/* Body Content */}
                          <div className="pt-1">
                            {isExpanded ? (
                              <div
                                dangerouslySetInnerHTML={{ __html: entry.bodyHtml }}
                                style={
                                  {
                                    '--entry-body-font': FONT_FAMILY_MAP[entry.fontStyle || 'calibri'],
                                    fontFamily: FONT_FAMILY_MAP[entry.fontStyle || 'calibri']
                                  } as React.CSSProperties
                                }
                                className="entry-body-content text-sm sm:text-base leading-relaxed text-slate-800 font-medium"
                              />
                            ) : (
                              <p
                                style={
                                  {
                                    '--entry-body-font': FONT_FAMILY_MAP[entry.fontStyle || 'calibri'],
                                    fontFamily: FONT_FAMILY_MAP[entry.fontStyle || 'calibri']
                                  } as React.CSSProperties
                                }
                                className="entry-body-content text-sm sm:text-base leading-relaxed text-slate-700 font-medium"
                              >
                                {previewText || 'No text written on this page…'}
                                {plainText.length > 160 && '…'}
                              </p>
                            )}
                          </div>

                          {/* Read Full Page Toggle */}
                          {plainText.length > 160 && (
                            <button
                              onClick={(e) => toggleExpand(entry.id, e)}
                              className="mt-2.5 inline-flex items-center gap-1 text-xs font-extrabold text-[#007AFF] hover:underline cursor-pointer"
                            >
                              <span>{isExpanded ? 'Show less' : 'Read full page'}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-[#007AFF]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#007AFF]" />}
                            </button>
                          )}

                          {/* Photos Attached Grid */}
                          {images.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2.5 border-t border-slate-200 pt-3">
                              {images.map((img) => (
                                <img
                                  key={img.id}
                                  src={img.url}
                                  alt={img.name}
                                  className="h-16 w-24 rounded-2xl object-cover border border-slate-300 shadow-2xs transition hover:scale-105 cursor-pointer"
                                  onClick={() => onOpenEntry(entry)}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Card Quick Actions Bar */}
                        <div className="flex shrink-0 items-center gap-1.5 border-t border-slate-200 pt-3 sm:border-t-0 sm:pt-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onToggleBookmark(entry)
                            }}
                            className={`flex h-9 w-9 items-center justify-center rounded-2xl transition cursor-pointer ${
                              entry.bookmarked
                                ? 'bg-amber-100 text-[#FF9500] border border-amber-300 shadow-2xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                            }`}
                            title={entry.bookmarked ? 'Bookmarked' : 'Bookmark'}
                          >
                            <Star className={`w-4 h-4 ${entry.bookmarked ? 'fill-[#FF9500] text-[#FF9500]' : 'text-slate-600'}`} />
                          </button>

                          <button
                            onClick={(e) => handleCopy(entry, e)}
                            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 cursor-pointer shadow-2xs"
                            title="Copy text"
                          >
                            {copiedId === entry.id ? <Check className="w-4 h-4 text-[#30D158]" /> : <Copy className="w-4 h-4 text-slate-600" />}
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpenEntry(entry)
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 cursor-pointer shadow-2xs"
                            title="Edit entry"
                          >
                            <Edit3 className="w-4 h-4 text-slate-600" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onSoftDelete(entry)
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-red-50 text-[#FF3B30] hover:bg-[#FF3B30] hover:text-white cursor-pointer shadow-2xs transition"
                            title="Move to trash"
                          >
                            <Trash2 className="w-4 h-4 text-current" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
