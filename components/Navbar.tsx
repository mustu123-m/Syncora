"use client"

import { signIn, signOut, useSession } from "next-auth/react"
import Image from "next/image"
import Link from "next/link"

export default function Navbar() {
  const { data: session, status } = useSession()
  const loading = status === "loading"

  return (
    <nav className="w-full border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="text-white font-semibold text-lg tracking-tight hover:text-zinc-300 transition-colors">
          VideoApp
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />
          ) : session ? (
            <>
              {/* User info */}
              <div className="flex items-center gap-2">
                {session.user?.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    width={32}
                    height={32}
                    className="rounded-full ring-1 ring-zinc-700"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-white text-xs font-medium">
                    {session.user?.name?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
                <span className="text-zinc-300 text-sm hidden sm:block">
                  {session.user?.name}
                </span>
              </div>

              {/* Sign out */}
              <button
                onClick={() => signOut()}
                className="text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-md transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => signIn()}
              className="text-sm text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-1.5 rounded-md transition-colors"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
