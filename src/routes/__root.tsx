import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Sidebar } from '#/components/layout/Sidebar'
import { Toasts } from '#/components/grid/Toasts'
import { CurseBanner } from '#/dashboard/CurseBanner'
import { TopBar } from '#/dashboard/TopBar'
import { useLiveStream } from '#/dashboard/live'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Control Center · Guardians of the Grid' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
  component: AppLayout,
})

function AppLayout() {
  // One QueryClient per browser tab (and per server render), created once.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }),
  )
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen">
        <Sidebar />
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

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-app font-sans antialiased">
        {children}
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
