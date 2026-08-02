import type { JournalEntry } from '../types'
import { FONT_FAMILY_MAP } from './EntryEditor'
import { Star, Image as ImageIcon, FileText } from 'lucide-react'

function stripHtml(html: string) {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

export function EntryCard({ entry, onOpen }: { entry: JournalEntry; onOpen: () => void }) {
  const plainText = stripHtml(entry.bodyHtml)
  const preview = plainText.slice(0, 130)
  const cover = entry.media.find((m) => m.kind === 'image')
  const date = new Date(entry.createdAt)
  const monthName = date.toLocaleDateString(undefined, { month: 'short' })
  const dayNum = date.getDate()
  const yearNum = date.getFullYear()

  return (
    <div
      onClick={onOpen}
      className="group relative flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm hover:shadow-xl hover:border-[#007AFF] transition-all duration-200 cursor-pointer overflow-hidden"
    >
      <div>
        {/* Top Header Row: Date Badge & Bookmark */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="inline-flex items-center gap-2 rounded-2xl bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-black text-[#007AFF]">
            <span>{monthName} {dayNum}, {yearNum}</span>
          </div>

          {entry.bookmarked && (
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-100 border border-amber-200 text-[#FF9500]">
              <Star className="w-3.5 h-3.5 fill-[#FF9500] text-[#FF9500]" />
            </div>
          )}
        </div>

        {/* Cover Image Preview if attached */}
        {cover ? (
          <div className="mb-3.5 overflow-hidden rounded-2xl border border-slate-200 h-36 w-full relative group-hover:scale-[1.01] transition duration-200">
            <img src={cover.url} alt="" className="h-full w-full object-cover" />
            <div className="absolute bottom-2 right-2 rounded-xl bg-black/70 px-2.5 py-1 text-[10px] font-extrabold text-white flex items-center gap-1">
              <ImageIcon className="w-3 h-3 text-white" />
              <span>{entry.media.length}</span>
            </div>
          </div>
        ) : null}

        {/* Title */}
        <h3
          style={{ fontFamily: FONT_FAMILY_MAP[entry.titleFontStyle || 'display'] }}
          className="text-lg sm:text-xl font-black text-slate-900 group-hover:text-[#007AFF] transition tracking-tight line-clamp-1"
        >
          {entry.title}
        </h3>

        {/* Body Preview */}
        <p className="mt-2 line-clamp-3 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
          {preview || 'No text written on this page…'}
        </p>
      </div>

      {/* Footer Info */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] font-bold text-slate-500">
        <span className="flex items-center gap-1 text-slate-600 font-mono">
          <FileText className="w-3.5 h-3.5 text-[#007AFF]" />
          <span>{plainText.split(/\s+/).filter(Boolean).length} words</span>
        </span>

        <span className="text-[#007AFF] font-extrabold group-hover:translate-x-0.5 transition">
          Open page →
        </span>
      </div>
    </div>
  )
}
