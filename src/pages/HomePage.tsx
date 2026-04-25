import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { ArrowRight, LogOut, Pencil, Radio, RefreshCw, Shield, Sparkles, Zap } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useMyRooms } from '@/hooks/useMyRooms'
import { useMyProfile } from '@/hooks/useMyProfile'
import { MyRoomsList } from '@/features/dashboard/MyRoomsList'
import { setUsername } from '@/services/userService'
import { getUsernameLabel } from '@/lib/getUsernameLabel'
import { EmailAuthCard } from '@/features/auth/EmailAuthCard'
function createLocalRoomId() {
  return nanoid(10)
}

function AccountCard(props: {
  usernameLabel: string
  emailLabel: string | null
  editing: boolean
  draft: string
  error: string | null
  saving: boolean
  onStartEdit: () => void
  onDraftChange: (next: string) => void
  onCancelEdit: () => void
  onSave: () => void
  onRefreshRooms: () => void
  onSignOut: () => void
}) {
  return (
    <div className="app-card w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-800/70 px-4 py-3.5 w-full">
        <div className="min-w-0 w-full">
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">Account</div>
          <div className="mt-1 min-w-0 w-full">
            {props.editing ? (
              <div className="space-y-2">
                <input
                  value={props.draft}
                  onChange={(e) => props.onDraftChange(e.target.value)}
                  disabled={props.saving}
                  className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950/60 px-3 text-sm font-medium text-zinc-100 placeholder:text-zinc-600"
                  placeholder="username"
                  maxLength={32}
                  aria-label="Username"
                  autoFocus
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={props.onSave}
                    disabled={props.saving}
                    className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-50 px-3 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={props.onCancelEdit}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900/70"
                  >
                    Cancel
                  </button>
                </div>
                {props.error ? <div className="text-xs text-rose-300">{props.error}</div> : null}
              </div>
            ) : (
              <div className="flex min-w-0 items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-zinc-100">{props.usernameLabel}</div>
                  {props.emailLabel ? (
                    <div className="mt-0.5 truncate text-xs text-zinc-500">{props.emailLabel}</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={props.onStartEdit}
                  className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950/30 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900/70"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={props.onRefreshRooms}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900/70"
        >
          <RefreshCw className="h-4 w-4 text-zinc-500" aria-hidden />
          Refresh rooms
        </button>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900/70"
          type="button"
          onClick={props.onSignOut}
        >
          <LogOut className="h-4 w-4 text-zinc-500" aria-hidden />
          Sign out
        </button>
      </div>
    </div>
  )
}

function NewRoomButton(props: { className?: string; size?: 'default' | 'large' }) {
  const navigate = useNavigate()
  const onCreateRoom = useCallback(() => {
    void navigate(`/room/${createLocalRoomId()}`)
  }, [navigate])
  const large = props.size === 'large'
  return (
    <button
      type="button"
      onClick={onCreateRoom}
      className={
        props.className ??
        (large
          ? 'inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-50 px-5 py-3.5 text-sm font-semibold text-zinc-950 shadow-sm transition hover:bg-white'
          : 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white')
      }
    >
      {large ? 'Start a new room' : 'New room'}
      <ArrowRight className="h-4 w-4" />
    </button>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { auth, signOut } = useAuth()
  const { rooms, loading, error, refetch } = useMyRooms(auth.status === 'signed_in')
  const signedIn = auth.status === 'signed_in'
  const profile = useMyProfile()
  const usernameLabel = useMemo(() => {
    if (auth.status !== 'signed_in') return null
    return profile.username ?? getUsernameLabel(auth.user)
  }, [auth])
  const emailLabel = useMemo(() => {
    if (auth.status !== 'signed_in') return null
    return auth.user.email ?? null
  }, [auth])

  const [nameEdit, setNameEdit] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [nameErr, setNameErr] = useState<string | null>(null)
  const [savingName, setSavingName] = useState(false)

  const openNameEdit = useCallback(() => {
    if (auth.status !== 'signed_in') return
    setNameDraft(profile.username ?? getUsernameLabel(auth.user))
    setNameErr(null)
    setNameEdit(true)
  }, [auth, profile.username])

  const saveName = useCallback(async () => {
    if (!nameEdit) return
    setSavingName(true)
    setNameErr(null)
    try {
      await setUsername(nameDraft)
      setNameEdit(false)
      void profile.refetch()
    } catch (e) {
      setNameErr(e instanceof Error ? e.message : 'Could not update username')
    } finally {
      setSavingName(false)
    }
  }, [nameDraft, nameEdit, profile])

  useEffect(() => {
    if (auth.status !== 'signed_in') return
    const from = (location.state as { from?: string } | null)?.from
    if (from && typeof from === 'string' && from.startsWith('/')) {
      navigate(from, { replace: true })
    }
  }, [auth.status, location.state, navigate])


  return (
    <main className="app-noise min-h-dvh bg-zinc-950 text-zinc-50">
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-8 md:px-8 md:py-10">
        <header className="flex flex-col gap-6 border-b border-zinc-800/80 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">Inbox, not a meeting</p>
            <h1 className="font-display mt-2 text-balance text-3xl font-semibold tracking-tight text-zinc-100 md:text-4xl">
              {signedIn ? 'Your rooms' : 'Rooms-first chat'}
            </h1>
            <p className="mt-3 max-w-prose text-pretty text-sm leading-relaxed text-zinc-400 md:text-base">
              {signedIn
                ? 'Open a thread or start a new one. Share a link to invite others in.'
                : 'Create a room, share a URL, and keep the conversation in one place — realtime messages, presence, and reactions, without a calendar block.'}
            </p>
          </div>
          {signedIn ? (
            <div className="hidden sm:flex shrink-0 items-center gap-2 self-start sm:self-auto">
              <span className="text-sm text-zinc-500">
                Signed in as <span className="font-medium text-zinc-200">{usernameLabel}</span>
              </span>
            </div>
          ) : null}
        </header>

        {signedIn ? (
          <div className="mt-8 grid min-h-0 flex-1 gap-8 lg:grid-cols-12 lg:gap-10">
            <section className="lg:col-span-8" aria-label="Your rooms">
              {usernameLabel ? (
                <div className="mb-4 w-full lg:hidden">
                  <AccountCard
                    usernameLabel={usernameLabel}
                    emailLabel={emailLabel}
                    editing={nameEdit}
                    draft={nameDraft}
                    error={nameErr}
                    saving={savingName}
                    onStartEdit={openNameEdit}
                    onDraftChange={(next) => {
                      setNameDraft(next)
                      setNameErr(null)
                    }}
                    onCancelEdit={() => {
                      setNameEdit(false)
                      setNameErr(null)
                    }}
                    onSave={() => void saveName()}
                    onRefreshRooms={() => void refetch()}
                    onSignOut={signOut}
                  />
                </div>
              ) : null}

              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-200">Recent activity</h2>
                  <p className="mt-0.5 text-sm text-zinc-500">Rooms you are a member of</p>
                </div>
                <span className="hidden sm:inline text-xs text-zinc-600">{rooms.length} total</span>
              </div>
              <MyRoomsList
                rooms={rooms}
                loading={loading}
                error={error}
                emptyCta={<NewRoomButton />}
              />
            </section>

            <aside className="lg:col-span-4">
              <div className="sticky top-6 flex flex-col gap-4">
                {usernameLabel ? (
                  <div className="hidden w-full lg:block">
                    <AccountCard
                      usernameLabel={usernameLabel}
                      emailLabel={emailLabel}
                      editing={nameEdit}
                      draft={nameDraft}
                      error={nameErr}
                      saving={savingName}
                      onStartEdit={openNameEdit}
                      onDraftChange={(next) => {
                        setNameDraft(next)
                        setNameErr(null)
                      }}
                      onCancelEdit={() => {
                        setNameEdit(false)
                        setNameErr(null)
                      }}
                      onSave={() => void saveName()}
                      onRefreshRooms={() => void refetch()}
                      onSignOut={signOut}
                    />
                  </div>
                ) : null}

                <div className="app-card overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                  <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">Quick start</div>
                  <p className="mt-2 text-sm text-zinc-300">Name it later. First message defines the room.</p>
                  <div className="mt-4">
                    <NewRoomButton size="large" />
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-5">
                  <h3 className="text-sm font-medium text-zinc-300">What you get</h3>
                  <ul className="mt-3 space-y-2.5 text-sm text-zinc-500">
                    <li className="flex items-start gap-2.5">
                      <Radio className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
                      Live presence and room activity
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Zap className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
                      Instant, optimistic messaging (with edits and reactions)
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Shield className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
                      Secure by design — you control your own messages
                    </li>
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <div className="mt-8 grid min-h-0 flex-1 gap-8 md:grid-cols-2 md:items-start">
            <div>
              <div className="app-card max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/40 p-1">
                <div className="rounded-[0.9rem] bg-zinc-950/40 p-5">
                  <EmailAuthCard />
                </div>
              </div>
              <p className="mt-6 text-sm text-zinc-500">
                Already have a room link?{' '}
                <span className="text-zinc-400">Open it, sign in, and you’ll land in the same URL.</span>
              </p>
            </div>
            <div className="app-card space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
              <div>
                <h2 className="text-sm font-semibold text-zinc-200">Try a room</h2>
                <p className="mt-1 text-sm text-zinc-500">You can create one before signing in; you’ll be asked to sign in to send.</p>
              </div>
              <NewRoomButton size="large" className="w-full" />
            </div>
          </div>
        )}

        <footer className="mt-16 border-t border-zinc-800/50 pt-8 text-xs text-zinc-500">
          <p>
            {signedIn ? (
              'Share room links only with people you trust. Anyone with a link can read the room once signed in.'
            ) : (
              <>
                <span className="text-zinc-400">Tip:</span> share <span className="text-zinc-500">/room/…</span> links — no
                org chart required.
              </>
            )}
          </p>
        </footer>
      </div>
    </main>
  )
}
