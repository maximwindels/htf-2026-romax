import {
  HeadContent,
  Outlet,
  ScriptOnce,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { THEME_BOOT_SCRIPT } from '#/lib/theme.ts'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Control Center' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
  // The sidebar layout lives in routes/_app.tsx, so /login can render full-screen.
  component: Outlet,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // data-theme: dark by default; the boot script switches it before paint, hence the warning opt-out.
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* ScriptOnce: runs during the server-rendered page load only, never re-rendered on the client. */}
        <ScriptOnce>{THEME_BOOT_SCRIPT}</ScriptOnce>
        <HeadContent />
      </head>
      <body className="bg-app font-sans antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
