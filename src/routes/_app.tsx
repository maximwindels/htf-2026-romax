import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { Sidebar } from '#/components/layout/Sidebar'
import { Toasts } from '#/components/grid/Toasts'
import { CurseBanner } from '#/dashboard/CurseBanner'
import { TopBar } from '#/dashboard/TopBar'
import { useLiveStream } from '#/dashboard/live'
import { getCurrentGuardian } from '#/lib/auth.functions.ts'

/** Layout for every page that needs a logged-in guardian. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    const guardian = await getCurrentGuardian()
    if (!guardian) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    return { guardian }
  },
  component: AppLayout,
})

function AppLayout() {
  const { guardian } = Route.useRouteContext()
  // One QueryClient per browser tab (and per server render), created once. Used by the live dashboard.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen">
        <Sidebar guardian={guardian} />
        <LiveArea />
      </div>
    </QueryClientProvider>
  )
}

/** Everything right of the sidebar: top bar, the page, and the live alert layers on top. */
function LiveArea() {
  const liveStatus = useLiveStream() // one live (SSE) connection for the whole app
  return (
    <div className="min-w-0 flex-1">
      <TopBar liveStatus={liveStatus} />
      <CurseBanner />
      <main className="min-w-0 px-16 py-10 max-md:px-4 max-md:py-6">
        <Outlet />
      </main>
      <Toasts />
    </div>
  )
}
