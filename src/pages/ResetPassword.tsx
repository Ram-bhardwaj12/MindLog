import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, BookOpen, Eye, EyeOff, Loader2, Lock, ArrowLeft } from 'lucide-react'
import { authApi } from '../lib/api'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const [token, setToken] = useState<string>(() => searchParams.get('token') || '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    // Strip reset token from the URL immediately on mount so it does not persist
    // in browser history or leak via HTTP Referer headers
    if (window.location.search.includes('token=')) {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('Missing or invalid reset token. Please request a new reset link.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    // Enforce 72-byte ceiling matching bcrypt and registration schema
    const byteLength = new TextEncoder().encode(newPassword).length
    if (byteLength > 72) {
      setError('Password cannot exceed 72 bytes.')
      return
    }

    setLoading(true)

    try {
      await authApi.resetPassword(token, newPassword)
      navigate('/login', {
        state: { notice: 'Password updated. Please sign in.' },
        replace: true,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] w-full overflow-y-auto bg-[#f3f6fc] flex flex-col justify-between p-4 sm:p-6 lg:p-8 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] select-none selection:bg-[#007AFF] selection:text-white">
      {/* Brand Header */}
      <header className="flex items-center justify-between mx-auto max-w-6xl w-full py-2 shrink-0 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#007AFF] text-white shadow-lg shadow-blue-500/25 ring-4 ring-blue-100 shrink-0">
            <BookOpen className="w-6 h-6 stroke-[2.6] text-white" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-sans leading-none">
              MindLog
            </h1>
            <p className="text-xs font-extrabold text-[#007AFF] mt-1">Personal Journal & Memory Sanctuary</p>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-md w-full my-auto py-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl space-y-5">
          {!token ? (
            /* Missing or Invalid Token State */
            <div className="space-y-4 text-center py-2">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                Invalid or Missing Link
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-slate-600 leading-relaxed">
                This password reset link is invalid or has expired. Please return to sign in and request a new reset link.
              </p>
              <div className="pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#007AFF] px-6 py-3 text-sm font-black text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-600"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            /* Password Reset Form */
            <>
              <div className="space-y-1 text-center pt-1">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  Set New Password
                </h2>
                <p className="text-xs font-bold text-slate-500">
                  Enter your new password below (minimum 8 characters)
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider" htmlFor="newPassword">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#007AFF] focus:ring-2 focus:ring-blue-500/20 font-semibold shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition cursor-pointer p-1 rounded-lg focus:outline-none"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-slate-500" />
                      ) : (
                        <Eye className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider" htmlFor="confirmPassword">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#007AFF] focus:ring-2 focus:ring-blue-500/20 font-semibold shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition cursor-pointer p-1 rounded-lg focus:outline-none"
                      title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4 text-slate-500" />
                      ) : (
                        <Eye className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div role="alert" className="flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-extrabold text-[#FF3B30] shadow-2xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-[#FF3B30]" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#007AFF] py-3.5 text-sm font-black text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-600 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 text-white animate-spin shrink-0" />
                      <span>Updating password…</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </form>

              <div className="pt-2 text-center text-xs font-bold text-slate-500 border-t border-slate-200">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1 font-black text-[#007AFF] hover:underline cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl w-full py-1 shrink-0 text-center text-[11px] font-bold text-slate-500">
        MindLog Personal Journal &copy; {new Date().getFullYear()} • Encrypted local & cloud memory workspace.
      </footer>
    </div>
  )
}
