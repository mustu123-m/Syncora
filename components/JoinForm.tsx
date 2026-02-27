'use client'
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card" 
import { useRouter } from 'next/navigation';
import { Input } from "@/components/ui/input"
import { Button } from './ui/button';
const JoinForm = () => {
    const [roomId,setRoomId]=useState("");
    const [name,setName]=useState("");

    const router=useRouter();

    
  function handleJoin() {
    // don't do anything if fields are empty
    if (!name.trim() || !roomId.trim()) return

    // navigate to /room/[roomId] and pass name as a URL query parameter
    // example: /room/abc123?name=John
    router.push(`/room/${roomId.trim()}?name=${name.trim()}`)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // allow pressing Enter to join instead of clicking button
    if (e.key === "Enter") handleJoin()
  }
    
  return (
     <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-white text-2xl">Join a Room</CardTitle>
        <CardDescription className="text-zinc-400">
          Enter your name and a room ID to start or join a call
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm text-zinc-400">Your Name</label>
          <Input
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-zinc-400">Room ID</label>
          <Input
            placeholder="e.g. my-meeting-123"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyDown={handleKeyDown}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
          />
        </div>

        <Button
          onClick={handleJoin}
          disabled={!name.trim() || !roomId.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-2"
        >
          Join Room
        </Button>
      </CardContent>
    </Card>
  )
}

export default JoinForm