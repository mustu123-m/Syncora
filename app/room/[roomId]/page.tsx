// app/room/[roomId]/page.tsx
"use client"

import { useSearchParams } from "next/navigation"
import { useSocket } from "@/hooks/useSocket"
import { useWebRTC } from "@/hooks/useWebRTC"
import { Button } from "@/components/ui/button"
import { use, useState } from "react"
import {Controls} from '@/components/Control'

// Next.js passes the dynamic [roomId] segment as a prop called params
export default function RoomPage({ params }: { params:  Promise<{ roomId: string }>  }) {
  const searchParams = useSearchParams()
  // read the name from the URL query: /room/abc?name=John → "John"
  const name = searchParams.get("name") || "Anonymous"
  const { roomId } = use(params)
  const { socket, isConnected } = useSocket()
  const { localVideoRef, remoteVideoRef, joinRoom ,isCameraOff,isMuted,toggleCamera,toggleMute,hasjoined} = useWebRTC(socket, roomId)

  return (
    <main className="flex flex-col min-h-screen bg-zinc-950 text-white">

      {/* top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h1 className="text-lg font-semibold">VideoApp</h1>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-sm text-zinc-400">
            {isConnected ? "Connected" : "Connecting..."}
          </span>
        </div>
        <span className="text-sm text-zinc-400">
          Room: <span className="text-white font-medium">{roomId}</span>
        </span>
      </div>

      {/* video area — we will build this next */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">

        {/* spotlight — big video */}
        <div className="w-full max-w-4xl aspect-video bg-zinc-900 rounded-2xl overflow-hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        </div>

        {/* small video — your own camera */}
        <div className="w-48 h-36 bg-zinc-900 rounded-xl overflow-hidden absolute bottom-28 right-8 border-2 border-zinc-700">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        </div>

      </div>

      {/* bottom controls */}
      {
      !hasjoined &&
      <div className="flex items-center justify-center gap-4 py-6 border-t border-zinc-800">
        <Button onClick={joinRoom} disabled={!isConnected}>
          Join Call
        </Button>
      </div>
}
      <Controls
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
      />

    </main>
  )
}