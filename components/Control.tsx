"use client"

import { Button } from "@/components/ui/button"
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react"
import { useRouter } from "next/navigation"

interface ControlsProps {
  isMuted: boolean
  isCameraOff: boolean
  onToggleMute: () => void
  onToggleCamera: () => void
  onLeave:()=>void
}

export function Controls({ isMuted, isCameraOff, onToggleMute, onToggleCamera,onLeave }: ControlsProps) {
  const router = useRouter()

  function leaveCall() {
    // go back to home page
    onLeave();
    router.push("/")
  }

  return (
    <div className="flex items-center justify-center gap-4 py-6 border-t border-zinc-800">

      {/* mute button */}
      <Button
        onClick={onToggleMute}
        variant={isMuted ? "destructive" : "secondary"}
        size="icon"
        className="w-12 h-12 rounded-full"
      >
        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </Button>

      {/* camera button */}
      <Button
        onClick={onToggleCamera}
        variant={isCameraOff ? "destructive" : "secondary"}
        size="icon"
        className="w-12 h-12 rounded-full"
      >
        {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
      </Button>

      {/* leave button */}
      <Button
        onClick={leaveCall}
        variant="destructive"
        size="icon"
        className="w-12 h-12 rounded-full"
      >
        <PhoneOff className="w-5 h-5" />
      </Button>

    </div>
  )
}