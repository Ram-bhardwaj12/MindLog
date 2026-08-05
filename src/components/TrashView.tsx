import { useState } from 'react'
import { Trash2, RotateCcw, Sparkles, AlertTriangle, X, Calendar, Clock } from 'lucide-react'
import type { JournalEntry } from '../types'
import { FONT_FAMILY_MAP } from './EntryEditor'

interface TrashViewProps {
  deletedEntries: JournalEntry[]
  onRestoreEntry: (id: string) => void
  onPermanentDelete: (id: string) => void
  onEmptyTrash: () => void
  onNewEntry: () => void
}

function stripHtml(html: string) {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

export function TrashView({
  deletedEntries,
  onRestoreEntry,
  onPermanentDelete,
  onEmptyTrash,
  onNewEntry
}: TrashViewProps) {
  const [confirmEmptyModal, setConfirmEmptyModal] = useState(false)
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<JournalEntry | null>(null)

  const handleConfirmEmpty = () => {
    onEmptyTrash()
    setConfirmEmptyModal(false)
  }

  const handleConfirmDeleteSingle = (id: string) => {
    onPermanentDelete(id)
    setConfirmDeleteEntry(null)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Top Banner */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-[#FF3B30] border border-red-200 shadow-2xs">
              <Trash2 className="w-6 h-6 stroke-[2.2] text-[#FF3B30]" />
            </div>
            <div>
              <h2 className="font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
                Recycle Bin
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-0.5">
                {deletedEntries.length} deleted {deletedEntries.length === 1 ? 'entry' : 'entries'} • Restore anytime or erase permanently.
              </p>
            </div>
          </div>

          {deletedEntries.length > 0 && (
            <button
              onClick={() => setConfirmEmptyModal(true)}
              className="flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 px-5 py-3 text-xs sm:text-sm font-extrabold text-[#FF3B30] transition hover:bg-[#FF3B30] hover:text-white shadow-xs cursor-pointer self-start sm:self-auto active:scale-95"
            >
              <Trash2 className="w-4 h-4 text-current" />
              <span>Empty All Trash ({deletedEntries.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Deleted Entries Feed */}
      {deletedEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 sm:p-14 text-center shadow-xs animate-in fade-in duration-200">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50/80 text-[#007AFF] mb-4 ring-8 ring-blue-50/40">
            <Trash2 className="w-10 h-10 stroke-[2] text-[#007AFF]" />
          </div>
          <h3 className="font-black text-xl sm:text-2xl text-slate-900 tracking-tight">Recycle Bin is Empty</h3>
          <p className="mt-2 text-xs sm:text-sm font-semibold text-slate-600 max-w-md leading-relaxed">
            No deleted pages here. Entries you delete will be safely kept here so you can restore them anytime!
          </p>
          <button
            onClick={onNewEntry}
            className="mt-6 rounded-2xl bg-[#007AFF] px-6 py-3 text-xs sm:text-sm font-black text-white transition hover:bg-blue-600 active:scale-95 shadow-md shadow-blue-500/20 cursor-pointer"
          >
            + Create New Entry
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {deletedEntries.map((entry) => {
            const plainText = stripHtml(entry.bodyHtml)
            const previewText = plainText.slice(0, 180)
            const deletedDateStr = entry.deletedAt
              ? new Date(entry.deletedAt).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : 'Recently deleted'

            return (
              <div
                key={entry.id}
                className="group relative rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <h4
                      style={{ fontFamily: FONT_FAMILY_MAP[entry.titleFontStyle || 'display'] }}
                      className="text-xl sm:text-2xl font-bold text-slate-400 line-through"
                    >
                      {entry.title}
                    </h4>

                    <p
                      style={{
                        '--entry-body-font': FONT_FAMILY_MAP[entry.fontStyle || 'calibri'],
                        fontFamily: FONT_FAMILY_MAP[entry.fontStyle || 'calibri']
                      } as React.CSSProperties}
                      className="entry-body-content text-sm sm:text-base leading-relaxed text-slate-500 font-medium"
                    >
                      {previewText || 'No text written on this page…'}
                      {plainText.length > 180 && '…'}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-2 font-mono text-xs font-semibold text-slate-500">
                      <span className="flex items-center gap-1.5 text-[#FF3B30] font-bold">
                        <Clock className="w-3.5 h-3.5 text-[#FF3B30]" />
                        <span>Deleted: {deletedDateStr}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#007AFF]" />
                        <span>Created: {new Date(entry.createdAt).toLocaleDateString()}</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-2.5 border-t border-slate-200 pt-3 sm:border-t-0 sm:pt-0">
                    <button
                      onClick={() => onRestoreEntry(entry.id)}
                      className="flex items-center gap-2 rounded-2xl bg-blue-50 border border-blue-200 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-[#007AFF] transition hover:bg-[#007AFF] hover:text-white cursor-pointer shadow-2xs active:scale-95"
                      title="Restore page back to journal"
                    >
                      <RotateCcw className="w-4 h-4 text-current" />
                      <span>Restore</span>
                    </button>

                    <button
                      onClick={() => setConfirmDeleteEntry(entry)}
                      className="flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-[#FF3B30] transition hover:bg-[#FF3B30] hover:text-white cursor-pointer shadow-2xs active:scale-95"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-4 h-4 text-current" />
                      <span>Delete Forever</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Confirmation Modal for Single Entry Delete */}
      {confirmDeleteEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] backdrop-blur-md transition-opacity">
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-[#FF3B30]">
                <AlertTriangle className="w-6 h-6 stroke-[2.2] text-[#FF3B30]" />
              </div>
              <button
                onClick={() => setConfirmDeleteEntry(null)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5 text-current" />
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                Permanently Delete Entry?
              </h3>
              <p className="text-sm font-medium text-slate-600 leading-relaxed">
                Are you sure you want to permanently erase <span className="font-extrabold text-slate-900">"{confirmDeleteEntry.title}"</span>? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDeleteEntry(null)}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-100 cursor-pointer shadow-2xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmDeleteSingle(confirmDeleteEntry.id)}
                className="flex items-center gap-2 rounded-2xl bg-[#FF3B30] px-5 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-red-600 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4 text-white" />
                <span>Yes, Delete Forever</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Empty All Trash */}
      {confirmEmptyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] backdrop-blur-md transition-opacity">
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-[#FF3B30]">
                <AlertTriangle className="w-6 h-6 stroke-[2.2] text-[#FF3B30]" />
              </div>
              <button
                onClick={() => setConfirmEmptyModal(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5 text-current" />
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                Empty Recycle Bin?
              </h3>
              <p className="text-sm font-medium text-slate-600 leading-relaxed">
                Are you sure you want to permanently erase all <span className="font-black text-[#FF3B30]">{deletedEntries.length} deleted items</span> in the trash? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmEmptyModal(false)}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-100 cursor-pointer shadow-2xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEmpty}
                className="flex items-center gap-2 rounded-2xl bg-[#FF3B30] px-5 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-red-600 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4 text-white" />
                <span>Yes, Empty All Trash</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
