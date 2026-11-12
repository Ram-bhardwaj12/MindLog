import type { AuthUser, JournalEntry } from '../types'
import type { EntryFields } from './entries'

/**
 * Standard API error detail shape from validation errors.
 */
export interface ApiErrorDetail {
  field?: string
  message: string
}

/**
 * Custom error class capturing backend HTTP status, machine error code,
 * and optional field-level validation details.
 */
export class ApiRequestError extends Error {
  readonly status: number
  readonly code?: string
  readonly details?: ApiErrorDetail[]

  constructor(message: string, status: number, code?: string, details?: ApiErrorDetail[]) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.details = details
  }
}

/**
 * Options for api requests.
 */
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

// Configurable API base URL: defaults to '/api' which Vite proxies to localhost:5000 in dev
const BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

type UnauthorizedHandler = () => void
let unauthorizedHandler: UnauthorizedHandler | null = null
let isHandlingUnauthorized = false

/**
 * Register a global callback invoked whenever an authenticated API call returns 401.
 * Pass null to deregister.
 */
export function setUnauthorizedHandler(fn: UnauthorizedHandler | null): void {
  unauthorizedHandler = fn
}

/**
 * Core HTTP request client.
 *
 * Enforces:
 * - credentials: 'include' on every request for HttpOnly cookie propagation
 * - automatic JSON serialization and Content-Type header management (bypassed for FormData)
 * - defensive JSON parsing to handle unexpected HTML gateway/proxy errors (e.g. 502/504)
 * - unwrapping the backend { success: true, data } response envelope
 * - translation of validation and server errors into ApiRequestError
 * - 401 interception to trigger automatic logout/redirect without loops
 */
export async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = `${BASE_URL}${normalizedPath}`

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options?.headers || {})
  }

  let body: BodyInit | undefined = undefined
  if (options?.body !== undefined && options?.body !== null) {
    if (options.body instanceof FormData) {
      body = options.body
      // Note: Delete Content-Type so browser sets multipart/form-data with proper boundary
      delete headers['Content-Type']
    } else if (typeof options.body === 'string') {
      body = options.body
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json'
      }
    } else {
      body = JSON.stringify(options.body)
      headers['Content-Type'] = 'application/json'
    }
  }

  const fetchOptions: RequestInit = {
    method: options?.method || 'GET',
    headers,
    body,
    credentials: 'include'
  }

  let response: Response
  try {
    response = await fetch(url, fetchOptions)
  } catch {
    throw new ApiRequestError("Can't reach the server. Check your connection and try again.", 0)
  }

  // Defensively parse body text and JSON to handle HTML error pages from proxies
  let rawText = ''
  try {
    rawText = await response.text()
  } catch {
    // Body read failed
  }

  interface ServerErrorEnvelope {
    success?: boolean
    error?: {
      code?: string
      message?: string
      details?: ApiErrorDetail[]
    }
    data?: unknown
  }

  let parsed: ServerErrorEnvelope | null = null
  if (rawText) {
    try {
      parsed = JSON.parse(rawText) as ServerErrorEnvelope
    } catch {
      // Non-JSON response (e.g. 502 Bad Gateway HTML from proxy)
    }
  }

  // Handle 401 Unauthorized for non-auth paths
  const isAuthExempt =
    normalizedPath === '/auth/login' ||
    normalizedPath === '/auth/register' ||
    normalizedPath === '/auth/me'

  if (response.status === 401 && !isAuthExempt) {
    if (unauthorizedHandler && !isHandlingUnauthorized) {
      isHandlingUnauthorized = true
      try {
        unauthorizedHandler()
      } finally {
        // Prevent redirect loops while allowing subsequent auth transitions
        setTimeout(() => {
          isHandlingUnauthorized = false
        }, 500)
      }
    }
  }

  // Error envelope or non-2xx status code handling
  if (!response.ok || (parsed && parsed.success === false)) {
    if (parsed && typeof parsed === 'object' && parsed.error) {
      const err = parsed.error
      let message = err.message || `Request failed with status ${response.status}`
      if (err.code === 'VALIDATION_ERROR' && Array.isArray(err.details) && err.details.length > 0) {
        const first = err.details[0]
        if (first && first.message) {
          message = first.message
        }
      }
      throw new ApiRequestError(message, response.status, err.code, err.details)
    }

    if (response.status >= 500) {
      throw new ApiRequestError(`Server error (${response.status}). Please try again.`, response.status)
    }
    throw new ApiRequestError(`Request failed with status ${response.status}.`, response.status)
  }

  // Success envelope unwrapping: backend uses { success: true, data: ... }
  if (parsed && typeof parsed === 'object' && 'data' in parsed) {
    return parsed.data as T
  }

  return (parsed as unknown) as T
}

/**
 * Authentication API methods.
 */
export const authApi = {
  register(email: string, password: string): Promise<{ user: AuthUser }> {
    return request<{ user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: { email, password }
    })
  },
  login(email: string, password: string): Promise<{ user: AuthUser }> {
    return request<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: { email, password }
    })
  },
  logout(): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/logout', {
      method: 'POST'
    })
  },
  me(): Promise<{ user: AuthUser }> {
    return request<{ user: AuthUser }>('/auth/me', {
      method: 'GET'
    })
  },
  forgotPassword(email: string): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: { email }
    })
  }
}

/**
 * Journal entries API methods.
 */
export const entriesApi = {
  list(includeTrash = true): Promise<{ entries: JournalEntry[] }> {
    return request<{ entries: JournalEntry[] }>(`/entries?includeTrash=${includeTrash}`, {
      method: 'GET'
    })
  },
  get(id: string): Promise<{ entry: JournalEntry }> {
    return request<{ entry: JournalEntry }>(`/entries/${id}`, {
      method: 'GET'
    })
  },
  create(fields: EntryFields & { createdAt?: string }): Promise<{ entry: JournalEntry }> {
    return request<{ entry: JournalEntry }>('/entries', {
      method: 'POST',
      body: fields
    })
  },
  update(id: string, fields: EntryFields): Promise<{ entry: JournalEntry }> {
    return request<{ entry: JournalEntry }>(`/entries/${id}`, {
      method: 'PUT',
      body: fields
    })
  },
  trash(id: string): Promise<{ entry: JournalEntry }> {
    return request<{ entry: JournalEntry }>(`/entries/${id}/trash`, {
      method: 'PATCH'
    })
  },
  restore(id: string): Promise<{ entry: JournalEntry }> {
    return request<{ entry: JournalEntry }>(`/entries/${id}/restore`, {
      method: 'PATCH'
    })
  },
  setBookmark(id: string, bookmarked: boolean): Promise<{ entry: JournalEntry }> {
    return request<{ entry: JournalEntry }>(`/entries/${id}/bookmark`, {
      method: 'PATCH',
      body: { bookmarked }
    })
  },
  deleteEntry(id: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/entries/${id}`, {
      method: 'DELETE'
    })
  },
  purgeTrash(ids: string[]): Promise<{ purgedCount: number }> {
    return request<{ purgedCount: number }>('/entries/trash/purge', {
      method: 'POST',
      body: { ids }
    })
  },
  uploadMedia(id: string, formData: FormData): Promise<{ entry: JournalEntry }> {
    return request<{ entry: JournalEntry }>(`/entries/${id}/media`, {
      method: 'POST',
      body: formData
    })
  },
  deleteMedia(id: string, mediaId: string): Promise<{ entry: JournalEntry }> {
    return request<{ entry: JournalEntry }>(`/entries/${id}/media/${mediaId}`, {
      method: 'DELETE'
    })
  }
}

