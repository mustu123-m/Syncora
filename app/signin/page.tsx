"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import Link from "next/link"

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit() {
    if (!email || !password) return
    setLoading(true)
    setError("")

    // signIn from next-auth/react handles the request
    // redirect: false means don't redirect automatically — we handle it
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false
    })

    setLoading(false)

    if (result?.error) {
      setError("Invalid email or password")
      return
    }

    // success — go to home
    router.push("/")
    router.refresh()  // refresh server components so they see the session
  }

  async function handleGoogle() {
    // redirect: true — let NextAuth handle the redirect to Google
    await signIn("google", { callbackUrl: "/" })
  }

  return (
    <main className="flex items-center justify-center min-h-screen bg-zinc-950">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-2xl">Welcome back</CardTitle>
          <CardDescription className="text-zinc-400">
            Sign in to your VideoApp account
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">

          {/* Google button */}
          <Button
            onClick={handleGoogle}
            variant="outline"
            className="w-full border-zinc-700 text-black hover:bg-zinc-800 gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>

          {/* divider */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-zinc-700" />
            <span className="text-xs text-zinc-500">or</span>
            <div className="flex-1 h-px bg-zinc-700" />
          </div>

          {/* email */}
          <div className="flex flex-col gap-2">
            <label className="text-sm text-zinc-400">Email</label>
            <Input
              type="email"
              placeholder="john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
          </div>

          {/* password */}
          <div className="flex flex-col gap-2">
            <label className="text-sm text-zinc-400">Password</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
          </div>

          {/* error message */}
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {/* submit */}
          <Button
            onClick={handleSubmit}
            disabled={!email || !password || loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>

          {/* link to signup */}
          <p className="text-center text-sm text-zinc-400">
            Don't have an account?{" "}
            <Link href="/signup" className="text-blue-400 hover:text-blue-300">
              Sign up
            </Link>
          </p>

        </CardContent>
      </Card>
    </main>
  )
}