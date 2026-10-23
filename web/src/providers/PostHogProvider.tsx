'use client'

import { attachPostHog, capturePageview } from '@/lib/posthogEvents'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef } from 'react'

const postHogEnabled =
  typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_POSTHOG_KEY

// posthog-js is fetched once the page's own load event has fired and the main
// thread is idle, so it never stands in front of the page it measures. Until
// then lib/posthogEvents.ts holds what is captured, pageviews included.
let requested = false

function loadPostHog() {
  if (requested) return
  requested = true
  void import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        ui_host: 'https://us.posthog.com',
        defaults: '2026-01-30',
        person_profiles: 'identified_only',
        capture_pageview: false,
      })
      attachPostHog(posthog)
    })
    // A chunk that does not arrive, or an init that throws, costs the
    // analytics and never the page.
    .catch(() => {})
}

function afterPageLoad(start: () => void) {
  let idle = 0
  const schedule = () => {
    idle =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(start, { timeout: 2000 })
        : window.setTimeout(start, 0)
  }
  if (document.readyState === 'complete') schedule()
  else window.addEventListener('load', schedule, { once: true })
  return () => {
    window.removeEventListener('load', schedule)
    if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idle)
    else window.clearTimeout(idle)
  }
}

function PostHogPageView({ enabled }: { enabled: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const previousUrl = useRef('')
  // The Build panel's case switch rewrites ?case= in place (replaceState):
  // picking a case is an event of its own (build_case_selected), not a page.
  // A /build?case= link still counts once, as the page it lands on.
  const params = new URLSearchParams(searchParams.toString())
  if (pathname === '/build') params.delete('case')
  const search = params.toString()

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const currentPath = `${pathname}${search ? `?${search}` : ''}`
    if (previousUrl.current === currentPath) return
    previousUrl.current = currentPath

    capturePageview()
  }, [enabled, pathname, search])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!postHogEnabled) return
    return afterPageLoad(loadPostHog)
  }, [])

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView enabled={postHogEnabled} />
      </Suspense>
      {children}
    </>
  )
}
