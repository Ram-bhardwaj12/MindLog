import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Settings,
  Trash2,
  PenSquare,
  Clock,
  Calendar,
  LayoutGrid,
  Search,
  X,
  LogOut,
  Star,
  Sparkles,
  Sliders,
  User,
  Bookmark,
  CalendarDays
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { EntryEditor, type SavePayload } from '../components/EntryEditor'
import { EntryCard } from '../components/EntryCard'
import { CalendarView } from '../components/CalendarView'
import { TimelineView } from '../components/TimelineView'
import { TrashView } from '../components/TrashView'
import {
  createEntry,
  emptyTrash,
  fetchEntries,
  permanentlyDeleteEntry,
  restoreEntry,
  setBookmarked,
  softDeleteEntry,
  updateEntry
} from '../lib/entries'
import type { JournalEntry } from '../types'

type ViewMode = 'timeline' | 'calendar' | 'cards' | 'trash'

const SITE_FONT_CSS: Record<string, string> = {
  calibri: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
  georgia: "Georgia, 'Times New Roman', serif",
  times: "'Times New Roman', Times, serif",
  garamond: "'EB Garamond', Garamond, Georgia, serif",
  arial: "Arial, Helvetica, sans-serif",
  comic: "'Comic Neue', 'Comic Sans MS', cursive, sans-serif",
  courier: "'Courier Prime', 'Courier New', monospace",
  verdana: "Verdana, Geneva, sans-serif",
  journal: "'Lora', Georgia, serif",
  handwriting: "'Caveat', cursive, sans-serif",
  display: "'Fraunces', Georgia, serif",
  body: "'Work Sans', sans-serif"
}

export default function Journal() {
  const { user, signOut } = useAuth()

  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('timeline')
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null) // YYYY-MM-DD
  const [editorEntry, setEditorEntry] = useState<JournalEntry | null | undefined>(undefined)
  const [pendingCreateDate, setPendingCreateDate] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Global Site Font Preference
  const [siteFont, setSiteFont] = useState<string>(() => {
    return localStorage.getItem('dear_diary_site_font') || 'calibri'
  })
  const [siteFontSize, setSiteFontSize] = useState<string>(() => {
    return localStorage.getItem('dear_diary_site_font_size') || '16px'
  })

  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 2500)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchEntries()
      .then((data) => {
        if (!cancelled) setEntries(data)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load your entries.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('dear_diary_site_font', siteFont)
    const fontCss = SITE_FONT_CSS[siteFont] || SITE_FONT_CSS.calibri
    document.documentElement.style.setProperty('--site-font', fontCss)
    document.body.style.fontFamily = fontCss

    let styleTag = document.getElementById('site-font-override') as HTMLStyleElement
    if (!styleTag) {
      styleTag = document.createElement('style')
      styleTag.id = 'site-font-override'
      document.head.appendChild(styleTag)
    }
    styleTag.innerHTML = `
      body, #root, #root *, h1, h2, h3, h4, h5, h6, p, span, button, input, select, textarea, label {
        font-family: ${fontCss} !important;
      }
      .entry-body-content, .entry-body-content * {
        font-family: var(--entry-body-font, ${fontCss}) !important;
      }
    `
  }, [siteFont])

  useEffect(() => {
    localStorage.setItem('dear_diary_site_font_size', siteFontSize)
    document.documentElement.style.fontSize = siteFontSize
    document.documentElement.style.setProperty('--site-text-size', siteFontSize)
    document.body.style.fontSize = siteFontSize

    let styleTag = document.getElementById('site-font-size-override') as HTMLStyleElement
    if (!styleTag) {
      styleTag = document.createElement('style')
      styleTag.id = 'site-font-size-override'
      document.head.appendChild(styleTag)
    }
    styleTag.innerHTML = `
      html, body {
        font-size: ${siteFontSize} !important;
      }
    `
  }, [siteFontSize])

  const activeEntries = useMemo(() => entries.filter((e) => !e.deletedAt), [entries])
  const deletedEntries = useMemo(() => entries.filter((e) => Boolean(e.deletedAt)), [entries])
  const bookmarkedEntries = useMemo(() => activeEntries.filter((e) => e.bookmarked), [activeEntries])

  const filtered = useMemo(() => {
    let result = [...activeEntries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    if (selectedDateFilter) {
      result = result.filter((e) => {
        const d = new Date(e.createdAt)
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        return `${yyyy}-${mm}-${dd}` === selectedDateFilter
      })
    }

    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter((e) => e.title.toLowerCase().includes(q) || e.bodyHtml.toLowerCase().includes(q))
    }

    return result
  }, [activeEntries, query, selectedDateFilter])

  const groupedGridEntries = useMemo(() => {
    const map = new Map<string, JournalEntry[]>()
    filtered.forEach((entry) => {
      const date = new Date(entry.createdAt)
      const monthYear = isNaN(date.getTime())
        ? 'Unknown Date'
        : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      const list = map.get(monthYear) || []
      list.push(entry)
      map.set(monthYear, list)
    })
    return Array.from(map.entries())
  }, [filtered])

  const handleSave = async (payload: SavePayload) => {
    const saved =
      editorEntry === null ||
      editorEntry === undefined ||
      !editorEntry.id ||
      !entries.some((e) => e.id === editorEntry.id)
        ? await createEntry(payload.fields, payload.pending, pendingCreateDate ?? undefined)
        : await updateEntry(editorEntry.id, payload.fields, payload.pending, payload.keptMediaIds)

    setEntries((prev) => {
      const exists = prev.some((e) => e.id === saved.id)
      return exists ? prev.map((e) => (e.id === saved.id ? saved : e)) : [saved, ...prev]
    })
    setEditorEntry(undefined)
    setPendingCreateDate(null)
  }

  const handleSoftDelete = async (id: string) => {
    await softDeleteEntry(id)
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, deletedAt: new Date().toISOString() } : e)))
    setEditorEntry(undefined)
  }

  const handleRestoreEntry = async (id: string) => {
    setActionError(null)
    try {
      await restoreEntry(id)
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, deletedAt: undefined } : e)))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not restore that entry.')
    }
  }

  const handlePermanentDelete = async (id: string) => {
    setActionError(null)
    try {
      await permanentlyDeleteEntry(id)
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete that entry.')
    }
  }

  const handleEmptyTrash = async () => {
    setActionError(null)
    const ids = deletedEntries.map((e) => e.id)
    try {
      await emptyTrash(ids)
      setEntries((prev) => prev.filter((e) => !e.deletedAt))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not empty the trash.')
    }
  }

  const handleNewEntryForDate = (dateStr: string) => {
    setPendingCreateDate(dateStr)
    setEditorEntry(null)
  }

  const handleToggleBookmark = async (entry: JournalEntry) => {
    setActionError(null)
    const next = !entry.bookmarked
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, bookmarked: next } : e)))
    try {
      await setBookmarked(entry.id, next)
    } catch (err) {
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, bookmarked: !next } : e)))
      setActionError(err instanceof Error ? err.message : 'Could not update the bookmark.')
    }
  }

  const today = new Date()
  const formattedTodayDate = today.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })

  return (
    <div className="min-h-screen text-slate-900 pb-20 relative bg-[#f3f6fc] selection:bg-[#007AFF] selection:text-white">
      {/* Top Navigation Bar - Stays STILL while rest of page scrolls */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-8 py-3">
          {/* Left: MindLog Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#007AFF] text-white shadow-md shadow-blue-500/20 ring-2 ring-blue-100 shrink-0">
              <BookOpen className="w-6 h-6 stroke-[2.5] text-white" />
            </div>

            <div className="flex flex-col">
              <span className="font-black tracking-tight text-slate-900 text-xl sm:text-2xl font-sans">
                MindLog
              </span>
              <span className="text-xs font-bold text-slate-500 hidden sm:inline-block">
                Personal Sanctuary & Daily Memories
              </span>
            </div>
          </div>

          {/* Right Controls: Search, Trash & Preferences */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search Input Box */}
            <div className="relative w-36 xs:w-44 sm:w-64 transition-all duration-200">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes..."
                className="w-full rounded-2xl border border-slate-300 bg-white pl-8.5 pr-7 py-1.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#007AFF] focus:ring-2 focus:ring-blue-500/20 font-semibold shadow-2xs"
              />
              {query ? (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 cursor-pointer p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-slate-500 bg-slate-100 rounded px-1 hidden sm:inline">
                  /
                </span>
              )}
            </div>

            {/* Preferences Trigger */}
            <div className="relative">
              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={`flex items-center gap-1.5 rounded-2xl border px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                  isSettingsOpen
                    ? 'border-[#007AFF] bg-[#007AFF] text-white shadow-sm'
                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 hover:text-[#007AFF]'
                }`}
                title="Settings & Font Options"
              >
                <Sliders className={`w-3.5 h-3.5 ${isSettingsOpen ? 'text-white' : 'text-slate-700'}`} />
                <span className="hidden sm:inline">Preferences</span>
              </button>

              {/* Preferences Options Panel */}
              {isSettingsOpen && (
                <div className="absolute right-0 top-11 z-50 w-80 rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl text-slate-900 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/5">
                  <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-50 text-[#007AFF]">
                        <Sliders className="w-4 h-4 text-[#007AFF]" />
                      </div>
                      <h3 className="font-extrabold text-sm text-slate-900">Control Preferences</h3>
                    </div>
                    <button
                      onClick={() => setIsSettingsOpen(false)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 cursor-pointer"
                    >
                      <X className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                        Typography Style
                      </label>
                      <select
                        value={siteFont}
                        onChange={(e) => {
                          const val = e.target.value
                          setSiteFont(val)
                          triggerToast(`Typography changed to ${val}`)
                        }}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none transition focus:border-[#007AFF] cursor-pointer shadow-2xs"
                      >
                        <option value="calibri" style={{ fontFamily: SITE_FONT_CSS.calibri }}>SF Pro / System Sans</option>
                        <option value="georgia" style={{ fontFamily: SITE_FONT_CSS.georgia }}>Georgia (Classic Serif)</option>
                        <option value="times" style={{ fontFamily: SITE_FONT_CSS.times }}>Times New Roman</option>
                        <option value="garamond" style={{ fontFamily: SITE_FONT_CSS.garamond }}>Garamond (Book Serif)</option>
                        <option value="arial" style={{ fontFamily: SITE_FONT_CSS.arial }}>Arial (Clean Sans)</option>
                        <option value="comic" style={{ fontFamily: SITE_FONT_CSS.comic }}>Comic Sans MS</option>
                        <option value="courier" style={{ fontFamily: SITE_FONT_CSS.courier }}>Courier New</option>
                        <option value="journal" style={{ fontFamily: SITE_FONT_CSS.journal }}>Lora (Warm Journal)</option>
                        <option value="handwriting" style={{ fontFamily: SITE_FONT_CSS.handwriting }}>Caveat (Handwritten)</option>
                        <option value="display" style={{ fontFamily: SITE_FONT_CSS.display }}>Fraunces (Display Serif)</option>
                        <option value="body" style={{ fontFamily: SITE_FONT_CSS.body }}>Work Sans</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                        Base Font Size
                      </label>
                      <select
                        value={siteFontSize}
                        onChange={(e) => {
                          const val = e.target.value
                          setSiteFontSize(val)
                          triggerToast(`Font size updated to ${val}`)
                        }}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none transition focus:border-[#007AFF] cursor-pointer shadow-2xs"
                      >
                        <option value="14px">Small (14px)</option>
                        <option value="16px">Medium (16px standard)</option>
                        <option value="18px">Large (18px)</option>
                        <option value="20px">Extra Large (20px)</option>
                      </select>
                    </div>

                    {/* Live Interactive Typography Preview Box */}
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3 text-center space-y-1">
                      <div className="text-[10px] font-black uppercase tracking-wider text-[#007AFF]">
                        Live Typography Preview ({siteFontSize})
                      </div>
                      <p
                        style={{
                          fontFamily: SITE_FONT_CSS[siteFont] || SITE_FONT_CSS.calibri,
                          fontSize: siteFontSize
                        }}
                        className="text-slate-900 font-extrabold truncate px-1"
                      >
                        MindLog: Capture your daily thoughts & memories.
                      </p>
                    </div>

                    <div className="border-t border-slate-200 pt-3">
                      <div className="mb-3 flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-bold flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-[#007AFF]" /> Account
                        </span>
                        <span className="font-mono text-[11px] font-bold text-slate-800 truncate max-w-[150px]">
                          {user?.email}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setIsSettingsOpen(false)
                          signOut()
                        }}
                        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-2.5 text-xs font-extrabold text-[#FF3B30] hover:bg-[#FF3B30] hover:text-white transition shadow-2xs cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5 text-current" /> Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-4 sm:px-8 pt-[calc(5.25rem+env(safe-area-inset-top,0px))] sm:pt-24">
        {/* HERO SECTION: App Title & Integrated Dashboard Widgets */}
        <section className="mb-8">
          {/* Big App Title Header */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 font-sans">
                MindLog
              </h1>
              <p className="mt-1.5 text-sm sm:text-base font-bold text-slate-600 max-w-xl">
                Your private sanctuary for daily thoughts, memories & reflections.
              </p>
            </div>

            {/* Quick Live Date Pill */}
            <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-xs shrink-0 self-start sm:self-auto">
              <CalendarDays className="w-5 h-5 text-[#007AFF] stroke-[2.4]" />
              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Today</span>
                <span className="text-xs sm:text-sm font-extrabold text-slate-900">{formattedTodayDate}</span>
              </div>
            </div>
          </div>

          {/* Unified 3-Widget Dashboard Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Widget 1: Quick Capture Box (Click anywhere or logo to open new entry) */}
            <div
              onClick={() => {
                setPendingCreateDate(null)
                setEditorEntry(null)
              }}
              className="md:col-span-1 rounded-3xl bg-gradient-to-br from-[#007AFF] via-[#2563EB] to-[#5856D6] p-6 text-white shadow-xl shadow-blue-500/25 flex flex-col justify-between relative overflow-hidden group cursor-pointer hover:shadow-2xl transition-all duration-200"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 text-white border border-white/30 shadow-inner group-hover:scale-110 transition duration-200">
                    <PenSquare className="w-5 h-5 stroke-[2.4] text-white" />
                  </div>
                  <span className="text-[10px] font-extrabold tracking-widest uppercase bg-white/20 px-3 py-1 rounded-full text-white border border-white/30">
                    Quick Capture
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white tracking-tight group-hover:translate-x-0.5 transition">Write New Memory</h3>
                <p className="mt-1.5 text-xs text-blue-100 font-semibold leading-relaxed">
                  Create a new page for today's thoughts, photos, and highlights.
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setPendingCreateDate(null)
                  setEditorEntry(null)
                }}
                className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-[#007AFF] transition-all group-hover:bg-slate-50 group-hover:scale-[1.02] active:scale-95 shadow-lg cursor-pointer w-full"
              >
                <PenSquare className="w-4 h-4 text-[#007AFF]" />
                <span>+ Write New Entry</span>
              </button>
            </div>

            {/* Widget 2: Summary Metrics */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-[#007AFF]" /> Summary Metrics
                </span>
                <span className="text-xs font-extrabold text-slate-700 bg-slate-100 rounded-full px-2.5 py-0.5 border border-slate-200">
                  Active Feed
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 my-2 text-center">
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-2.5">
                  <div className="text-2xl font-black text-slate-900">{activeEntries.length}</div>
                  <div className="text-[10px] font-extrabold text-slate-600 uppercase mt-0.5">Entries</div>
                </div>

                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-2.5">
                  <div className="text-2xl font-black text-[#FF9500]">{bookmarkedEntries.length}</div>
                  <div className="text-[10px] font-extrabold text-amber-800 uppercase mt-0.5">Bookmarked</div>
                </div>

                <div className="rounded-2xl bg-red-50 border border-red-200 p-2.5">
                  <div className="text-2xl font-black text-[#FF3B30]">{deletedEntries.length}</div>
                  <div className="text-[10px] font-extrabold text-red-800 uppercase mt-0.5">Trash</div>
                </div>
              </div>

              <div className="text-[11px] font-bold text-slate-600 flex items-center justify-between border-t border-slate-200 pt-3">
                <span>Total Saved: <strong className="text-slate-900 font-extrabold">{entries.length}</strong></span>
                <span className="text-[#007AFF] font-extrabold">Auto-synced ✓</span>
              </div>
            </div>

            {/* Widget 3: Integrated View Navigation Switcher (Timeline, Calendar, Grid, Trash) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <LayoutGrid className="w-4 h-4 text-[#007AFF]" /> Navigation Views
                </span>
                <span className="text-[10px] font-extrabold text-[#007AFF] bg-blue-50 border border-blue-100 rounded-full px-2.5 py-0.5">
                  4 Views
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 my-1">
                {/* Timeline Feed Button */}
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-extrabold transition-all cursor-pointer border ${
                    viewMode === 'timeline'
                      ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-4 h-4 text-current shrink-0" />
                  <span className="truncate">Timeline</span>
                </button>

                {/* Calendar Button */}
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-extrabold transition-all cursor-pointer border ${
                    viewMode === 'calendar'
                      ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-4 h-4 text-current shrink-0" />
                  <span className="truncate">Calendar</span>
                </button>

                {/* Grid Cards Button */}
                <button
                  onClick={() => setViewMode('cards')}
                  className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-extrabold transition-all cursor-pointer border ${
                    viewMode === 'cards'
                      ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4 text-current shrink-0" />
                  <span className="truncate">Grid Cards</span>
                </button>

                {/* Trash Bin Button */}
                <button
                  onClick={() => setViewMode('trash')}
                  className={`flex items-center justify-between gap-1 rounded-2xl px-3 py-2.5 text-xs font-extrabold transition-all cursor-pointer border ${
                    viewMode === 'trash'
                      ? 'bg-[#FF3B30] text-white border-[#FF3B30] shadow-sm'
                      : 'bg-red-50/60 text-[#FF3B30] border-red-100 hover:bg-[#FF3B30] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Trash2 className="w-4 h-4 text-current shrink-0" />
                    <span className="truncate">Trash</span>
                  </div>
                  {deletedEntries.length > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                        viewMode === 'trash' ? 'bg-white text-[#FF3B30]' : 'bg-[#FF3B30] text-white'
                      }`}
                    >
                      {deletedEntries.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between border-t border-slate-200 pt-2.5">
                <span>Active Mode: <strong className="text-slate-900 font-extrabold uppercase">{viewMode}</strong></span>
                {selectedDateFilter && (
                  <button
                    onClick={() => setSelectedDateFilter(null)}
                    className="text-[10px] font-extrabold text-[#007AFF] underline hover:text-slate-900 cursor-pointer"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Quick Date Filter Active Notification Pill */}
        {selectedDateFilter && viewMode !== 'trash' && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 shadow-2xs">
            <span className="text-xs font-extrabold text-[#0056B3]">
              Filtered for date: {new Date(`${selectedDateFilter}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            <button
              onClick={() => setSelectedDateFilter(null)}
              className="text-xs font-extrabold text-[#007AFF] underline hover:text-slate-900 cursor-pointer"
            >
              Show all dates
            </button>
          </div>
        )}

        {/* Action / Error Banner */}
        {actionError && (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[#FF3B30]">
            <span className="text-xs sm:text-sm font-extrabold">{actionError}</span>
            <button onClick={() => setActionError(null)} className="text-xs font-extrabold underline cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* VIEW CONTENTS */}
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white py-20 text-center shadow-2xs">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#007AFF] animate-pulse mb-3">
              <BookOpen className="w-6 h-6 text-[#007AFF]" />
            </div>
            <p className="font-mono text-sm font-bold text-slate-600">Syncing your journal memories…</p>
          </div>
        ) : loadError ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center shadow-2xs">
            <p className="text-sm font-extrabold text-[#FF3B30]">{loadError}</p>
            <p className="mt-2 text-xs text-slate-600 font-semibold">
              Please check your database connectivity, then refresh the page.
            </p>
          </div>
        ) : viewMode === 'trash' ? (
          <TrashView
            deletedEntries={deletedEntries}
            onRestoreEntry={handleRestoreEntry}
            onPermanentDelete={handlePermanentDelete}
            onEmptyTrash={handleEmptyTrash}
            onNewEntry={() => setEditorEntry(null)}
          />
        ) : viewMode === 'calendar' ? (
          <CalendarView
            entries={activeEntries}
            selectedDate={selectedDateFilter}
            onSelectDate={setSelectedDateFilter}
            onNewEntryForDate={handleNewEntryForDate}
            onOpenEntry={(entry) => setEditorEntry(entry)}
          />
        ) : viewMode === 'timeline' ? (
          <TimelineView
            entries={filtered}
            onOpenEntry={(entry) => setEditorEntry(entry)}
            onNewEntry={() => setEditorEntry(null)}
            onToggleBookmark={handleToggleBookmark}
            onSoftDelete={(entry) => handleSoftDelete(entry.id)}
          />
        ) : (
          /* Cards View Mode: Segregated by Month & Year, arranged by date */
          <div className="space-y-8">
            {filtered.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white py-20 text-center shadow-sm">
                <p className="font-extrabold text-xl text-slate-600">
                  {activeEntries.length === 0 ? 'No journal pages created yet.' : 'No matching entries found.'}
                </p>
                {activeEntries.length === 0 && (
                  <button
                    onClick={() => setEditorEntry(null)}
                    className="mt-4 rounded-2xl bg-[#007AFF] px-6 py-2.5 text-xs font-extrabold text-white transition hover:bg-blue-600 shadow-md cursor-pointer"
                  >
                    + Write First Entry Today
                  </button>
                )}
              </div>
            ) : (
              groupedGridEntries.map(([monthYear, monthEntries]) => (
                <div key={monthYear} className="space-y-4">
                  {/* Month & Year Section Badge */}
                  <div className="sticky top-16 sm:top-20 z-10 flex items-center gap-3 pt-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#007AFF] text-white shadow-sm ring-2 ring-blue-100">
                      <Calendar className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="rounded-full border border-slate-300 bg-white px-4 py-1 text-xs sm:text-sm font-black text-slate-900 shadow-xs">
                      {monthYear} <span className="text-[#007AFF] font-extrabold ml-1">({monthEntries.length} {monthEntries.length === 1 ? 'entry' : 'entries'})</span>
                    </h3>
                  </div>

                  {/* 3-Column Grid for this Month */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {monthEntries.map((entry) => (
                      <EntryCard key={entry.id} entry={entry} onOpen={() => setEditorEntry(entry)} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Editor Modal Container */}
      {editorEntry !== undefined && (
        <EntryEditor
          entry={editorEntry}
          onClose={() => {
            setEditorEntry(undefined)
            setPendingCreateDate(null)
          }}
          onSave={handleSave}
          onDelete={editorEntry ? handleSoftDelete : undefined}
        />
      )}

      {/* Floating Preferences Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] right-4 sm:right-6 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-2xl text-xs font-extrabold animate-in fade-in slide-in-from-bottom-5 duration-200">
          <Sparkles className="w-4 h-4 text-[#007AFF]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  )
}
