import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { KeyboardShortcuts } from '#/components/KeyboardShortcuts.tsx'
import { Sidebar } from '#/components/layout/Sidebar'
import { DesyncEffects } from '#/components/grid/DesyncEffects'
import { Toasts } from '#/components/grid/Toasts'
import { useDesync } from '#/dashboard/desync'
import { CurseBanner } from '#/dashboard/CurseBanner'
import { TopBar } from '#/dashboard/TopBar'
import { TabBar } from '#/dashboard/TabBar'
import { OraclePanel } from '#/dashboard/Oracle'
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
      <KeyboardShortcuts guardian={guardian} />
    </QueryClientProvider>
  )
}

/** Everything right of the sidebar: top bar, the page, and the live alert layers on top. */
function LiveArea() {
  const liveStatus = useLiveStream() // one live (SSE) connection for the whole app
  const desync = useDesync() // open errors -> Desync level 0-3, drives the UI corruption
  return (
    <div className="min-w-0 flex-1">
      <DesyncEffects state={desync} />
      <TopBar liveStatus={liveStatus} desync={desync} />
      <TabBar />
      <CurseBanner />
      <main className="min-w-0 px-16 py-10 max-md:px-4 max-md:py-6">
        <Outlet />
      </main>
      <Toasts />
      <OraclePanel />
    </div>
  )
}
