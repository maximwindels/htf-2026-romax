import { createFileRoute, redirect } from '@tanstack/react-router'
import { RoleBadge } from '#/components/RoleBadge.tsx'
import { getGuardians } from '#/lib/auth.functions.ts'
import { isCommander } from '#/lib/guardian.ts'

/** Admin page: only commanders may see the guardian roster. */
export const Route = createFileRoute('/_app/guardians')({
  beforeLoad: ({ context }) => {
    if (!isCommander(context.guardian)) throw redirect({ to: '/' })
  },
  loader: () => getGuardians(),
  component: GuardiansPage,
})

function GuardiansPage() {
  const guardians = Route.useLoaderData()

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold text-fg">Guardians</h1>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left">
          <thead>
            <tr className="border-b-2 border-line text-muted">
              <th className="px-5 py-4 font-normal">ID</th>
              <th className="px-5 py-4 font-normal">Codename</th>
              <th className="px-5 py-4 font-normal">Role</th>
            </tr>
          </thead>
          <tbody className="text-fg">
            {guardians.map((g) => (
              <tr key={g.guardianId}>
                <td className="px-5 py-4 whitespace-nowrap">{g.guardianId}</td>
                <td className="px-5 py-4">{g.codename}</td>
                <td className="px-5 py-4">
                  <RoleBadge role={g.role} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
