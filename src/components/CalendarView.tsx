import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Image as ImageIcon, Plus, Calendar, Sparkles, Clock, CalendarDays } from 'lucide-react'
import type { JournalEntry } from '../types'
import { FONT_FAMILY_MAP } from './EntryEditor'

interface CalendarViewProps {
  entries: JournalEntry[]
  selectedDate: string | null // YYYY-MM-DD
  onSelectDate: (dateStr: string | null) => void
  onNewEntryForDate: (dateStr: string) => void
  onOpenEntry: (entry: JournalEntry) => void
}

function getYearMonthKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function toLocalDateString(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function CalendarView({
  entries,
  selectedDate,
  onSelectDate,
  onNewEntryForDate,
  onOpenEntry
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const todayStr = toLocalDateString(new Date())

  // Map entries by YYYY-MM-DD
  const entriesByDate = useMemo(() => {
    const map = new Map<string, JournalEntry[]>()
    entries.forEach((entry) => {
      const d = new Date(entry.createdAt)
      if (isNaN(d.getTime())) return
      const key = toLocalDateString(d)
      const existing = map.get(key) || []
      existing.push(entry)
      map.set(key, existing)
    })
    return map
  }, [entries])

  // Calendar calculations
  const firstDayOfMonth = new Date(year, month, 1)
  const startingDayOfWeek = firstDayOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const goToToday = () => {
    const now = new Date()
    setCurrentDate(now)
    onSelectDate(toLocalDateString(now))
  }

  const selectedEntries = selectedDate ? entriesByDate.get(selectedDate) || [] : []
  const monthName = currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const isFutureDate = useMemo(() => {
    if (!selectedDate) return false
    return selectedDate > todayStr
  }, [selectedDate, todayStr])

  const calendarCells = []

  // Prev month filler
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i
    const prevDate = new Date(year, month - 1, dayNum)
    const dateStr = toLocalDateString(prevDate)
    const hasEntries = entriesByDate.has(dateStr)
    calendarCells.push({
      dayNum,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isFuture: dateStr > todayStr,
      isSelected: dateStr === selectedDate,
      entriesCount: hasEntries ? entriesByDate.get(dateStr)!.length : 0
    })
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(year, month, d)
    const dateStr = toLocalDateString(cellDate)
    const hasEntries = entriesByDate.has(dateStr)
    calendarCells.push({
      dayNum: d,
      dateStr,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      isFuture: dateStr > todayStr,
      isSelected: dateStr === selectedDate,
      entriesCount: hasEntries ? entriesByDate.get(dateStr)!.length : 0
    })
  }

  // Next month filler
  const remainingCells = 35 - calendarCells.length // 5 rows max for compact fit
  const maxCells = remainingCells >= 0 ? 35 : 42
  const totalFiller = maxCells - calendarCells.length

  for (let d = 1; d <= totalFiller; d++) {
    const nextDate = new Date(year, month + 1, d)
    const dateStr = toLocalDateString(nextDate)
    const hasEntries = entriesByDate.has(dateStr)
    calendarCells.push({
      dayNum: d,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isFuture: dateStr > todayStr,
      isSelected: dateStr === selectedDate,
      entriesCount: hasEntries ? entriesByDate.get(dateStr)!.length : 0
    })
  }

  return (
    <div className="mx-auto max-w-5xl grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
      {/* Calendar Grid Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm lg:col-span-7 xl:col-span-7">
        {/* Header Navigator */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-[#AF52DE] border border-purple-100 shadow-2xs">
              <Calendar className="w-5 h-5 stroke-[2.4] text-[#AF52DE]" />
            </div>
            <div>
              <h2 className="font-black text-xl sm:text-2xl text-slate-900 tracking-tight">
                {monthName}
              </h2>
              <p className="text-xs font-bold text-slate-600">
                {entries.filter((e) => getYearMonthKey(new Date(e.createdAt)) === getYearMonthKey(currentDate)).length}{' '}
                written page{entries.length === 1 ? '' : 's'} this month
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="rounded-2xl border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-extrabold text-[#007AFF] transition hover:bg-[#007AFF] hover:text-white cursor-pointer shadow-2xs"
            >
              Today
            </button>

            <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 p-1 shadow-2xs">
              <button
                onClick={prevMonth}
                className="p-1 text-slate-700 hover:text-[#007AFF] cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="h-3.5 w-px bg-slate-200 mx-0.5" />
              <button
                onClick={nextMonth}
                className="p-1 text-slate-700 hover:text-[#007AFF] cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Weekday Headers */}
        <div className="mb-2 grid grid-cols-7 text-center text-[11px] font-black tracking-wider text-slate-600 uppercase">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Responsive Calendar Grid Cells */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {calendarCells.map((cell, idx) => (
            <button
              key={idx}
              onClick={() => onSelectDate(cell.dateStr === selectedDate ? null : cell.dateStr)}
              className={`group relative flex h-14 sm:h-16 w-full flex-col justify-between rounded-2xl p-1.5 sm:p-2 transition-all cursor-pointer border ${
                cell.isSelected
                  ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-md ring-2 ring-blue-300'
                  : cell.isToday
                  ? 'border-2 border-[#007AFF] bg-blue-50/80 text-[#007AFF] font-black'
                  : cell.isFuture
                  ? 'bg-white hover:bg-purple-50/50 text-slate-900 border-slate-200/80'
                  : cell.isCurrentMonth
                  ? 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200'
                  : 'bg-slate-50/40 text-slate-400 border-transparent hover:bg-slate-100/50'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-xs ${
                    cell.isSelected
                      ? 'font-black text-white'
                      : cell.isToday
                      ? 'font-black text-[#007AFF]'
                      : cell.isCurrentMonth
                      ? 'font-extrabold text-slate-900'
                      : 'font-semibold text-slate-400'
                  }`}
                >
                  {cell.dayNum}
                </span>

                {cell.isToday && !cell.isSelected && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#007AFF]" />
                )}
              </div>

              {/* Entry Count Indicator Pill */}
              {cell.entriesCount > 0 && (
                <div className="mt-auto flex items-center justify-end w-full">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-2xs ${
                      cell.isSelected
                        ? 'bg-amber-400 text-slate-900'
                        : 'bg-[#007AFF] text-white'
                    }`}
                  >
                    <span>{cell.entriesCount}</span>
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Clear Date Filter Control (if filtered) */}
        {selectedDate && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
            <span className="font-extrabold text-slate-600">
              Selected: <strong className="text-slate-900">{new Date(`${selectedDate}T00:00:00`).toLocaleDateString()}</strong>
            </span>
            <button
              onClick={() => onSelectDate(null)}
              className="text-[#007AFF] font-extrabold hover:underline cursor-pointer"
            >
              Clear date filter
            </button>
          </div>
        )}
      </div>

      {/* Selected Date Drawer (Responsive Note & Future Event Creator) */}
      <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm lg:col-span-5 xl:col-span-5">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-900">
                {selectedDate
                  ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })
                  : 'Calendar Notes'}
              </h3>
              {isFutureDate && (
                <span className="rounded-full bg-purple-100 border border-purple-200 px-2 py-0.5 text-[10px] font-black text-[#AF52DE]">
                  Future Date
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-slate-600">
              {selectedDate
                ? `${selectedEntries.length} ${selectedEntries.length === 1 ? 'note' : 'notes'} on this day`
                : 'Select any calendar date to inspect or add notes'}
            </p>
          </div>

          {selectedDate && (
            <button
              onClick={() => onNewEntryForDate(selectedDate)}
              className={`flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-extrabold text-white transition shadow-md cursor-pointer active:scale-95 ${
                isFutureDate
                  ? 'bg-[#AF52DE] hover:bg-purple-700'
                  : 'bg-[#007AFF] hover:bg-blue-600'
              }`}
            >
              <Plus className="w-4 h-4 text-white" />
              <span>{isFutureDate ? '+ Add Note' : '+ Note'}</span>
            </button>
          )}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto max-h-[420px] pr-1">
          {selectedDate && selectedEntries.length === 0 ? (
            isFutureDate ? (
              /* Future Date Custom Note Creator Card */
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-purple-300 bg-purple-50/60 p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-[#AF52DE] mb-3 border border-purple-200">
                  <CalendarDays className="w-6 h-6 text-[#AF52DE]" />
                </div>
                <h4 className="text-base font-black text-slate-900">Plan Ahead for {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</h4>
                <p className="text-xs font-semibold text-slate-600 mt-1 max-w-xs leading-relaxed">
                  Select this future date to write an important note, schedule an event reminder, or plan your goals ahead of time.
                </p>
                <button
                  onClick={() => onNewEntryForDate(selectedDate)}
                  className="mt-4 flex items-center gap-2 rounded-2xl bg-[#AF52DE] px-5 py-2.5 text-xs font-black text-white transition hover:bg-purple-700 shadow-md cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>+ Add Important Note for Future Date</span>
                </button>
              </div>
            ) : (
              /* Past / Current Empty Date Card */
              <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
                <Sparkles className="w-6 h-6 text-[#007AFF] opacity-80 mb-2" />
                <p className="text-sm font-extrabold text-slate-800">No entry written on this date.</p>
                <p className="text-xs font-semibold text-slate-500 mt-1">Tap below to capture your thoughts for this date.</p>
                <button
                  onClick={() => onNewEntryForDate(selectedDate)}
                  className="mt-4 flex items-center gap-1.5 rounded-2xl bg-[#007AFF] px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-blue-600 shadow-md cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-white" /> Write Entry For Date
                </button>
              </div>
            )
          ) : (
            (selectedDate ? selectedEntries : entries.slice(0, 8)).map((entry) => (
              <button
                key={entry.id}
                onClick={() => onOpenEntry(entry)}
                className="group flex w-full flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#007AFF] hover:shadow-md cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="truncate text-base font-black text-slate-900 group-hover:text-[#007AFF] transition">
                    {entry.title}
                  </h4>
                  <span className="font-mono text-xs font-extrabold text-slate-500 shrink-0">
                    {new Date(entry.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600 leading-relaxed font-medium">
                  {entry.bodyHtml.replace(/<[^>]*>/g, '') || 'Empty page…'}
                </p>
                {entry.media.length > 0 && (
                  <span className="mt-2.5 flex items-center gap-1 text-[11px] font-extrabold text-[#007AFF]">
                    <ImageIcon className="w-3.5 h-3.5 text-[#007AFF]" />
                    <span>{entry.media.length} attachment{entry.media.length > 1 ? 's' : ''}</span>
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
