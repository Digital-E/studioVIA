import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const secret = searchParams.get('secret')
  const redirectTo = searchParams.get('redirect') ?? '/'

  if (secret !== process.env.SANITY_PREVIEW_SECRET && process.env.NODE_ENV !== 'development') {
    return new Response('Invalid token', { status: 401 })
  }

  ;(await draftMode()).enable()
  redirect(redirectTo)
}
