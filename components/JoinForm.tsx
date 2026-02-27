"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function JoinForm() {
  const [name, setName] = useState("")
  const [roomId, setRoomId] = useState("")
  const [isRestricted, setIsRestricted] = useState(false)
  // which mode are we in — create or join
  const [mode, setMode] = useState<"create" | "join">("create")

  const router = useRouter()

  function handleCreate() {
    if (!name.trim()) return
    // pass name and isRestricted to the room page via URL
    // room ID will be generated inside useWebRTC
    router.push(`/room/new?name=${name.trim()}&restricted=${isRestricted}&host=true`)
  }

  function handleJoin() {
    if (!name.trim() || !roomId.trim()) return
    router.push(`/room/${roomId.trim()}?name=${name.trim()}`)
  }

  return (
    <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-white text-2xl">VideoApp</CardTitle>
        <CardDescription className="text-zinc-400">
          Start a new meeting or join an existing one
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">

        {/* mode toggle */}
        <div className="flex rounded-lg overflow-hidden border border-zinc-700">
          <button
            onClick={() => setMode("create")}
            className={`flex-1 py-2 text-sm font-medium transition-colors
              ${mode === "create"
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
          >
            Create Meeting
          </button>
          <button
            onClick={() => setMode("join")}
            className={`flex-1 py-2 text-sm font-medium transition-colors
              ${mode === "join"
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
          >
            Join Meeting
          </button>
        </div>

        {/* name field — always shown */}
        <div className="flex flex-col gap-2">
          <label className="text-sm text-zinc-400">Your Name</label>
          <Input
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
          />
        </div>

        {/* room ID — only shown in join mode */}
        {mode === "join" && (
          <div className="flex flex-col gap-2">
            <label className="text-sm text-zinc-400">Room ID</label>
            <Input
              placeholder="e.g. ABC123"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
          </div>
        )}

        {/* restricted toggle — only shown in create mode */}
        {mode === "create" && (
          <div className="flex items-center justify-between py-2">
            <div className="flex flex-col">
              <span className="text-sm text-white">Require approval to join</span>
              <span className="text-xs text-zinc-400">
                Guests must wait for your permission
              </span>
            </div>
            <button
              onClick={() => setIsRestricted(prev => !prev)}
              className={`w-12 h-6 rounded-full transition-colors relative
                ${isRestricted ? "bg-blue-600" : "bg-zinc-600"}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform
                ${isRestricted ? "translate-x-6" : "translate-x-0.5"}`}
              />
            </button>
          </div>
        )}

        {/* action button */}
        {mode === "create" ? (
          <Button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-2"
          >
            Create Meeting
          </Button>
        ) : (
          <Button
            onClick={handleJoin}
            disabled={!name.trim() || !roomId.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-2"
          >
            Join Meeting
          </Button>
        )}

      </CardContent>
    </Card>
  )
}
