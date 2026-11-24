import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { Sidebar } from '#/components/layout/Sidebar'
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

  return (
    <div className="flex min-h-screen">
      <Sidebar guardian={guardian} />
      <main className="min-w-0 flex-1 px-16 py-10">
        <Outlet />
      </main>
    </div>
  )
}
