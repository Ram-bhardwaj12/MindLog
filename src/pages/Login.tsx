import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Lock, Mail, BookOpen, Sparkles, Eye, EyeOff, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { DeskScene } from '../components/DeskScene'

type Mode = 'sign_in' | 'sign_up'

export default function Login() {
  const [mode, setMode] = useState<Mode>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)

    try {
      if (mode === 'sign_in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/')
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setNotice('Check your inbox to confirm your email, then sign in.')
        setMode('sign_in')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!email) {
      setError('Enter your email address above to receive a reset link.')
      return
    }
    setError(null)
    setNotice(null)
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`
    })
    setLoading(false)
    if (error) setError(error.message)
    else setNotice('Password reset link sent — check your inbox.')
  }

  return (
    <div className="min-h-[100dvh] w-full overflow-y-auto bg-[#f3f6fc] flex flex-col justify-between p-4 sm:p-6 lg:p-8 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] select-none selection:bg-[#007AFF] selection:text-white">
      {/* Eye-Catchy Big Brand Header */}
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

      {/* Main Grid: Blue Image & Welcome Tab aligned in the same line */}
      <main className="mx-auto max-w-6xl w-full my-auto py-4 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch overflow-y-auto lg:overflow-visible">
        {/* Left Column: Blue Image Card aligned with Welcome card */}
        <div className="hidden lg:flex lg:col-span-6 flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-xl relative overflow-hidden">
          <div className="h-[270px] xl:h-[300px] w-full rounded-2xl overflow-hidden shadow-md border border-slate-200 bg-[#0072BB] relative">
            <DeskScene />
          </div>

          <div className="pt-4 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-[#007AFF]">
              <Sparkles className="w-3.5 h-3.5 text-[#007AFF]" />
              <span>Private & Encrypted Sanctuary</span>
            </div>
            <h2 className="text-2xl xl:text-3xl font-black text-slate-900 leading-tight">
              Your private sanctuary for thoughts & memories.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-semibold">
              MindLog provides an editorial digital notebook with rich formatting, audio & visual media attachments, and timeline organization.
            </p>
          </div>
        </div>

        {/* Right Column: Welcome & Authentication Form Card */}
        <div className="lg:col-span-6 max-w-md w-full mx-auto lg:ml-auto flex flex-col justify-center">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl space-y-5">
            {/* Segmented Sign In / Create Account Tab Switcher - Just above Welcome Header */}
            <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-100 p-1.5 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setMode('sign_in')
                  setError(null)
                  setNotice(null)
                }}
                className={`flex-1 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-extrabold transition-all cursor-pointer text-center ${
                  mode === 'sign_in'
                    ? 'bg-[#007AFF] text-white shadow-sm'
                    : 'text-slate-700 hover:bg-white/60 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('sign_up')
                  setError(null)
                  setNotice(null)
                }}
                className={`flex-1 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-extrabold transition-all cursor-pointer text-center ${
                  mode === 'sign_up'
                    ? 'bg-[#007AFF] text-white shadow-sm'
                    : 'text-slate-700 hover:bg-white/60 hover:text-slate-900'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Welcome Header */}
            <div className="space-y-1 text-center pt-1">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                {mode === 'sign_in' ? 'Welcome Back' : 'Start Your Journal'}
              </h3>
              <p className="text-xs font-bold text-slate-500">
                {mode === 'sign_in'
                  ? 'Sign in to access your personal journal memories'
                  : 'Create a free private digital diary in seconds'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider" htmlFor="email">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="author@example.com"
                    className="w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#007AFF] focus:ring-2 focus:ring-blue-500/20 font-semibold shadow-2xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider" htmlFor="password">
                    Password
                  </label>
                  {mode === 'sign_in' && (
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      className="text-xs font-extrabold text-[#007AFF] hover:underline cursor-pointer"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete={mode === 'sign_in' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#007AFF] focus:ring-2 focus:ring-blue-500/20 font-semibold shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition cursor-pointer p-1 rounded-lg focus:outline-none"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
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

              {notice && (
                <div role="status" className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-extrabold text-emerald-800 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{notice}</span>
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
                    <span>Please wait…</span>
                  </>
                ) : (
                  <span>{mode === 'sign_in' ? 'Sign In to Journal' : 'Create Free Account'}</span>
                )}
              </button>
            </form>

            <div className="pt-2 text-center text-xs font-bold text-slate-500 border-t border-slate-200">
              {mode === 'sign_in' ? "Don't have a diary yet? " : 'Already keeping a journal? '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'sign_in' ? 'sign_up' : 'sign_in')
                  setError(null)
                  setNotice(null)
                }}
                className="font-black text-[#007AFF] hover:underline cursor-pointer"
              >
                {mode === 'sign_in' ? 'Create an Account' : 'Sign In'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl w-full py-1 shrink-0 text-center text-[11px] font-bold text-slate-500">
        MindLog Personal Journal &copy; {new Date().getFullYear()} • Encrypted local & cloud memory workspace.
      </footer>
    </div>
  )
}
