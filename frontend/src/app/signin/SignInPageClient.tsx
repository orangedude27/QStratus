"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/components/auth/AuthProvider"
import { getBackendPath } from "@/lib/backend/getBackendPath"

import SignInButton from "./SignInButton"

type AuthConfig = {
  googleEnabled: boolean
  whitelistEnabled: boolean
  localEnabled: boolean
}

type SignInPageClientProps = {
  error: string | null
}

function SessionStatus() {
  return (
    <main className='relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-background px-4'>
      <video
        autoPlay
        loop
        muted
        playsInline
        className='pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-40'
      >
        <source src='/gradient.mp4' type='video/mp4' />
      </video>

      <div className='rounded-lg border border-border/70 bg-card/80 px-5 py-4 text-center shadow-lg shadow-blue-400/15 backdrop-blur'>
        <p className='text-sm text-muted-foreground'>Checking session...</p>
      </div>
    </main>
  )
}

export default function SignInPageClient({
  error,
}: Readonly<SignInPageClientProps>) {
  const router = useRouter()
  const { status } = useAuth()
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null)
  const [configError, setConfigError] = useState(false)

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/browse")
    }

    if (status === "needs-username") {
      router.replace("/signin/username")
    }
  }, [router, status])

  useEffect(() => {
    if (status !== "unauthenticated") return

    fetch(getBackendPath("/auth/config"))
      .then((res) => res.json())
      .then((config) => {
        setAuthConfig(config)
      })
      .catch(() => {
        setConfigError(true)
      })
  }, [status])

  if (status !== "unauthenticated") {
    return <SessionStatus />
  }

  const googleAvailable = authConfig?.googleEnabled ?? !configError
  const localAvailable = authConfig?.localEnabled ?? true

  return (
    <main className='relative flex min-h-0 flex-1 items-center justify-center overflow-x-hidden overflow-y-auto bg-background px-4 py-10 sm:px-6 lg:px-8'>
      <video
        autoPlay
        loop
        muted
        playsInline
        className='pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-60'
      >
        <source src='/gradient.mp4' type='video/mp4' />
      </video>
      <div className='pointer-events-none absolute inset-0 -z-10 bg-background/25' />

      <div className='mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_0.92fr]'>
        <section className='flex flex-col items-center text-center lg:items-start lg:text-left'>
          <h1 className='max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl'>
            Sign in to your self-hosted Stratus server
          </h1>

          <p className='mt-5 max-w-2xl text-lg font-medium leading-relaxed text-muted-foreground md:text-xl'>
            {googleAvailable
              ? "Sign in with your local account or continue with Google."
              : "Sign in with your local account."}
          </p>

          {!googleAvailable && (
            <div className='mt-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300'>
              <svg
                className='h-4 w-4 flex-shrink-0'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z'
                />
              </svg>
              <span>Google sign-in is not configured on this server</span>
            </div>
          )}
        </section>

        <section className='w-full'>
          <div className='mx-auto w-full max-w-md rounded-xl border border-border/70 bg-card/85 p-5 shadow-xl shadow-blue-400/25 backdrop-blur md:p-8'>
            <div className='mb-6'>
              <h1 className='mt-2 text-3xl font-bold tracking-tight md:text-4xl'>
                Sign In
              </h1>
              <p className='mt-1 text-sm text-muted-foreground'>
                {googleAvailable
                  ? "Use your local account or Google"
                  : "Use your local account"}
              </p>
            </div>

            <SignInButton />

            {error && (
              <div className='mt-5 rounded-lg border border-red-500/70 bg-red-500/10 p-3 text-sm text-red-200'>
                {error}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
