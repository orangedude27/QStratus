"use client"

import { CredentialResponse, GoogleLogin } from "@react-oauth/google"
import { FormEvent, useRef, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/components/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function SignInButton() {
  const router = useRouter()
  const { signInWithGoogle, signInWithLocal, registerLocal } = useAuth()
  const isSubmittingRef = useRef(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mode, setMode] = useState<"login" | "register">("login")
  const [localError, setLocalError] = useState<string | null>(null)
  const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    if (isSubmittingRef.current) {
      return
    }

    try {
      if (!credentialResponse.credential) {
        throw new Error("Google sign-in did not return a credential")
      }

      isSubmittingRef.current = true
      setIsSubmitting(true)

      const result = await signInWithGoogle(credentialResponse.credential)

      if (result.needsUsername) {
        router.replace("/signin/username")
        return
      }

      router.replace("/browse")
    } catch (err) {
      isSubmittingRef.current = false
      setIsSubmitting(false)
      console.error("Login failed:", err)
      const message =
        err instanceof Error ? err.message : "Google sign-in failed"
      router.replace(`/signin?error=${encodeURIComponent(message)}`)
    }
  }

  const handleLocalSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSubmittingRef.current) {
      return
    }

    const formData = new FormData(event.currentTarget)
    const username = formData.get("username")?.toString().trim() || ""
    const password = formData.get("password")?.toString() || ""

    if (!username || !password) {
      setLocalError("Username and password are required")
      return
    }

    if (mode === "register" && password.length < 8) {
      setLocalError("Password must be at least 8 characters")
      return
    }

    try {
      setLocalError(null)
      isSubmittingRef.current = true
      setIsSubmitting(true)

      if (mode === "register") {
        await registerLocal(username, password)
      } else {
        await signInWithLocal(username, password)
      }

      router.replace("/browse")
    } catch (err) {
      isSubmittingRef.current = false
      setIsSubmitting(false)
      const message = err instanceof Error ? err.message : "Authentication failed"
      setLocalError(message)
    }
  }

  return (
    <div className='space-y-5'>
      <form onSubmit={handleLocalSubmit} className='space-y-3'>
        <Input
          id='username'
          name='username'
          type='text'
          autoComplete='username'
          placeholder='Username'
          className='h-11 border-border/70 bg-background/45'
          required
        />
        <Input
          id='password'
          name='password'
          type='password'
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          placeholder='Password'
          className='h-11 border-border/70 bg-background/45'
          required
        />

        {localError && (
          <div className='rounded-lg border border-red-500/70 bg-red-500/10 p-3 text-sm text-red-200'>
            {localError}
          </div>
        )}

        <Button
          type='submit'
          className='h-11 w-full shadow-md shadow-blue-400/10'
          disabled={isSubmitting}
        >
          {isSubmitting && <LoaderCircle className='h-4 w-4 animate-spin' />}
          {mode === "register" ? "Create Account" : "Sign In"}
        </Button>

        <Button
          type='button'
          variant='ghost'
          className='h-10 w-full'
          onClick={() => {
            setMode(mode === "register" ? "login" : "register")
            setLocalError(null)
          }}
          disabled={isSubmitting}
        >
          {mode === "register"
            ? "Already have an account? Sign in"
            : "Need an account? Register"}
        </Button>
      </form>

      {googleEnabled && (
        <>
          <div className='relative text-center text-xs uppercase tracking-[0.2em] text-muted-foreground'>
            <span className='relative z-10 bg-card px-3'>or continue with</span>
            <div className='absolute inset-x-0 top-1/2 -z-0 h-px bg-border' />
          </div>

          {isSubmitting ? (
            <Button
              type='button'
              variant='outline'
              className='h-11 w-full justify-center border-border/70 bg-background/50 text-foreground shadow-md shadow-blue-400/10'
              disabled
            >
              <LoaderCircle className='h-4 w-4 animate-spin' />
              Signing you in...
            </Button>
          ) : (
            <GoogleLogin
              onSuccess={handleSuccess}
              theme='outline'
              size='medium'
              text='signin_with'
              shape='rectangular'
              logo_alignment='left'
              width='300'
              containerProps={{
                className: "flex w-full justify-center",
              }}
              onError={() =>
                router.replace(
                  `/signin?error=${encodeURIComponent("Google sign-in failed")}`,
                )
              }
            />
          )}
        </>
      )}
    </div>
  )
}
