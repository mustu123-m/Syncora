import { useEffect, useRef, useState } from "react"
import { io, Socket } from "socket.io-client"

export function useSocket() {
  const socket = useRef<Socket | null>(null)
  // tracks whether socket is actually connected yet
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // create the socket connection once on mount
    socket.current = io()

    socket.current.on("connect", () => {
      console.log("connected! id:", socket.current?.id)
      setIsConnected(true)
    })

    socket.current.on("disconnect", () => {
      setIsConnected(false)
    })

    // cleanup when component unmounts
    return () => {
      socket.current?.disconnect()
    }
  }, []) // empty array = run once on mount

  return { socket, isConnected }
}