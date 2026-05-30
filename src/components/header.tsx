'use client'

import { signOut, useSession } from 'next-auth/react'

export function Header() {
  const { data: session } = useSession()

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">{session?.user?.name}</span>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="rounded-md px-3 py-1 text-sm text-gray-500 hover:bg-gray-100"
        >
          خروج
        </button>
      </div>
    </header>
  )
}
