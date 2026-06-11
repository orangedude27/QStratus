import { GoogleOAuthProvider } from "@react-oauth/google"
import type { Metadata } from "next"

import Nav from "@/components/Nav"
import { isStaticExport } from "@/lib/static-export"

import SignInPageClient from "./SignInPageClient"

export const metadata: Metadata = {
  title: "Sign In",
}

type Props = {
  searchParams: Promise<{ error?: string }>
}

async function SignInPageContent({ searchParams }: Props) {
  const { error } = await searchParams

  return <SignInPageClient error={error ?? null} />
}

export default function SignInPage({ searchParams }: Props) {
  if (isStaticExport) {
    return null
  }

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""

  const content = (
    <div className='flex min-h-0 flex-1 flex-col'>
      <Nav hideSearchBar />
      <SignInPageContent searchParams={searchParams} />
    </div>
  )

  if (!googleClientId) {
    return content
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      {content}
    </GoogleOAuthProvider>
  )
}
