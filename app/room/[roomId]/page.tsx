"use client"

import { use, useEffect, useRef, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSocket } from "@/hooks/useSocket"
import { useWebRTC } from "@/hooks/useWebRTC"
import { Controls } from "@/components/Control"
import { Button } from "@/components/ui/button"
export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params)
  const searchParams = useSearchParams()
  const router = useRouter()

  const name = searchParams.get("name") || "Anonymous"
  const isHost = searchParams.get("host") === "true"
  const isRestricted = searchParams.get("restricted") === "true"

  const { socket, isConnected } = useSocket()
  const {
    localVideoRef,
    remoteStreams,
    participants,
    hasJoined,
    isWaiting,
    isDenied,
    waitingList,
    isMuted,
    isCameraOff,
    createRoom,
    joinRoom,
    leaveRoom,
    admitParticipant,
    denyParticipant,
    toggleMute,
    toggleCamera,
  } = useWebRTC(socket, roomId)

  // actual room ID — for host this gets set after room is created
  const [actualRoomId, setActualRoomId] = useState(
    roomId === "new" ? "" : roomId
  )

  // auto join once socket is connected
  useEffect(() => {
    if (!isConnected) return

    if (isHost && roomId === "new") {
      // host — create a new room
      createRoom(name, isRestricted).then((newRoomId) => {
        if (newRoomId) setActualRoomId(newRoomId)
      })
    } else {
      // guest — join existing room
      joinRoom(name)
    }
  }, [isConnected])

  // if host ends meeting, go back home
  useEffect(() => {
    if (!isHost && isDenied) return
    socket.current?.on("meeting-ended", () => {
      router.push("/")
    })
  }, [socket, isHost])

  // convert remoteStreams map to array for rendering
  const remoteStreamList = Array.from(remoteStreams.entries()).map(
    ([socketId, { stream, name }]) => ({ socketId, stream, name })
  )

  // DENIED screen
  if (isDenied) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 gap-4">
        <div className="text-6xl">🚫</div>
        <h1 className="text-2xl font-bold text-white">Request Denied</h1>
        <p className="text-zinc-400">The host did not admit you to this meeting.</p>
        <Button onClick={() => router.push("/")} className="bg-blue-600 hover:bg-blue-700">
          Go Back Home
        </Button>
      </main>
    )
  }

  // WAITING screen
  if (isWaiting) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <h1 className="text-2xl font-bold text-white">Waiting for Host</h1>
        <p className="text-zinc-400">The host will admit you shortly...</p>
        <Button
          onClick={() => router.push("/")}
          variant="outline"
          className="border-zinc-700 text-zinc-400"
        >
          Cancel
        </Button>
      </main>
    )
  }

  // MAIN ROOM
  return (
    <main className="flex flex-col min-h-screen bg-zinc-950 text-white">

      {/* top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h1 className="text-lg font-semibold">VideoApp</h1>

        {/* show room ID so host can share it */}
        {actualRoomId && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">Room:</span>
            <span className="text-white font-mono font-bold">{actualRoomId}</span>
            <button
              onClick={() => navigator.clipboard.writeText(actualRoomId)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Copy
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-sm text-zinc-400">
            {participants.length + 1} participant{participants.length !== 0 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* waiting list — only host sees this */}
      {isHost && waitingList.length > 0 && (
        <div className="flex flex-col gap-2 px-6 py-4 border-b border-zinc-800 bg-zinc-900">
          <p className="text-sm font-medium text-zinc-300">Waiting to join:</p>
          {waitingList.map(person => (
            <div key={person.socketId} className="flex items-center justify-between">
              <span className="text-white">{person.name}</span>
              <div className="flex gap-2">
                <Button
                  onClick={() => admitParticipant(person.socketId,actualRoomId)}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Admit
                </Button>
                <Button
                  onClick={() => denyParticipant(person.socketId,actualRoomId)}
                  size="sm"
                  variant="destructive"
                >
                  Deny
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* video area */}
      <div className="flex-1 relative p-4 flex flex-col gap-4">

        {/* spotlight — first remote stream or empty */}
        <div className="w-full flex-1 bg-zinc-900 rounded-2xl overflow-hidden relative min-h-64">
          {remoteStreamList.length > 0 ? (
            <>
              <RemoteVideo
                stream={remoteStreamList[0].stream}
                name={remoteStreamList[0].name}
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-500">
              {hasJoined ? "Waiting for others to join..." : "Connecting..."}
            </div>
          )}
        </div>

        {/* other participants — shown below spotlight */}
        {remoteStreamList.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {remoteStreamList.slice(1).map(({ socketId, stream, name }) => (
              <div key={socketId} className="flex-shrink-0 w-40 h-28 bg-zinc-900 rounded-xl overflow-hidden relative">
                <RemoteVideo stream={stream} name={name} small />
              </div>
            ))}
          </div>
        )}

        {/* your own camera — bottom right */}
        <div className="absolute bottom-8 right-8 w-40 h-28 bg-zinc-900 rounded-xl overflow-hidden border-2 border-zinc-700 shadow-xl">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-1 left-0 right-0 text-center">
            <span className="text-xs text-white bg-black/50 px-2 py-0.5 rounded-full">
              You
            </span>
          </div>
        </div>

      </div>

      {/* controls */}
      <Controls
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onLeave={() => {
          leaveRoom(actualRoomId)
          router.push("/")
        }}
      />

    </main>
  )
}

// separate component for remote video
// needed because we have to set srcObject via ref
function RemoteVideo({ stream, name, small = false }: {
  stream: MediaStream
  name: string
  small?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-0 right-0 text-center">
        <span className={`text-white bg-black/50 px-2 py-0.5 rounded-full
          ${small ? "text-xs" : "text-sm"}`}>
          {name}
        </span>
      </div>
    </div>
  )
}