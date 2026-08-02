import type { JournalEntry } from '../types'

const today = new Date()

function formatDateOffset(daysAgo: number, hours: number = 10, minutes: number = 15): string {
  const d = new Date(today)
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hours, minutes, 0, 0)
  return d.toISOString()
}

export const SAMPLE_ENTRIES: JournalEntry[] = [
  {
    id: 'sample-1',
    title: 'A quiet morning reflection',
    bodyHtml:
      '<p>Woke up to the gentle hum of rain outside. Made a fresh cup of dark roast coffee and sat by the window. There is something comforting about starting the day without rushing.</p><p>Goals for today: finish reading Chapter 4, take a long evening walk, and organize the bookshelf.</p>',
    media: [],
    createdAt: formatDateOffset(0, 9, 30), // Today
    updatedAt: formatDateOffset(0, 9, 30),
    titleFontStyle: 'display',
    fontStyle: 'journal',
    mood: '☕ Cozy'
  },
  {
    id: 'sample-2',
    title: 'Subtle light in the garden',
    bodyHtml:
      '<p>Spent the afternoon tending to the potted botanicals on the balcony. The golden hour lighting was breathtaking — captured a quick photo of the ferns before twilight set in.</p>',
    media: [
      {
        id: 'media-1',
        kind: 'image',
        url: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=600&q=80',
        name: 'garden.jpg'
      }
    ],
    createdAt: formatDateOffset(1, 17, 45), // Yesterday
    updatedAt: formatDateOffset(1, 17, 45),
    titleFontStyle: 'georgia',
    fontStyle: 'handwriting',
    mood: '🌿 Calm'
  },
  {
    id: 'sample-3',
    title: 'Notes on focus and solitude',
    bodyHtml:
      '<p>"Solitude is where one discovers one’s own rhythm." Worked uninterrupted for three hours on the new project layout. It feels good to get into a state of deep flow.</p>',
    media: [],
    createdAt: formatDateOffset(3, 14, 20), // 3 days ago
    updatedAt: formatDateOffset(3, 14, 20),
    titleFontStyle: 'garamond',
    fontStyle: 'garamond',
    mood: '🚀 Focused'
  },
  {
    id: 'sample-4',
    title: 'Weekend coffee & sketch',
    bodyHtml:
      '<p>Met up with Maya at the corner cafe. Sketched a few quick ideas for the journal redesign on paper napkins over warm cinnamon lattes.</p>',
    media: [],
    createdAt: formatDateOffset(5, 11, 0), // 5 days ago
    updatedAt: formatDateOffset(5, 11, 0),
    titleFontStyle: 'comic',
    fontStyle: 'comic',
    mood: '✨ Joyful'
  }
]
