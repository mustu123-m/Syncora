import { useRef, useState } from "react"
import { Socket } from "socket.io-client"

interface Participant {
  socketId: string
  name: string
}

export function useWebRTC(
  socket: React.MutableRefObject<Socket | null>,
  roomId: string,
) {
  const localStream = useRef<MediaStream | null>(null)
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
   
  function setLocalVideoRef(element: HTMLVideoElement | null) {
  localVideoRef.current = element
  // if stream already exists when element mounts, set it immediately
  if (element && localStream.current) {
    element.srcObject = localStream.current
  }
}

  const [remoteStreams, setRemoteStreams] = useState<Map<string, {
    stream: MediaStream
    name: string
  }>>(new Map())

  const [participants, setParticipants] = useState<Participant[]>([])
  const [isHost, setIsHost] = useState(false)
  const [hasJoined, setHasJoined] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const [isDenied, setIsDenied] = useState(false)
  const [waitingList, setWaitingList] = useState<Participant[]>([])
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)

  const myName = useRef<string>("")

  // FIX 2 — store names in a ref to avoid stale closure
  const participantNames = useRef<Map<string, string>>(new Map())

  // FIX 3 — queue ICE candidates per person
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())

   const iceConfig = {
    iceServers: [
      { urls: "stun:stun.metered.ca:80" },
      {
        urls: "turn:standard.relay.metered.ca:80",
        username: process.env.NEXT_PUBLIC_TURN_USERNAME,
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL
      },
      {
        urls: "turn:standard.relay.metered.ca:80?transport=tcp",
        username: process.env.NEXT_PUBLIC_TURN_USERNAME,
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL
      },
      {
        urls: "turn:standard.relay.metered.ca:443",
        username: process.env.NEXT_PUBLIC_TURN_USERNAME,
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL
      },
      {
        urls: "turns:standard.relay.metered.ca:443?transport=tcp",
        username: process.env.NEXT_PUBLIC_TURN_USERNAME,
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL
      }
    ]
  }

  function createPeerConnection(targetId: string, targetName: string) {
    const pc = new RTCPeerConnection(iceConfig)

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.current?.emit("ice-candidate", {
          candidate: event.candidate,
          targetId
        })
      }
    }

    pc.ontrack = (event) => {
      console.log("ontrack fired from:", targetName)
      setRemoteStreams(prev => {
        const updated = new Map(prev)
        updated.set(targetId, {
          stream: event.streams[0],
          name: targetName
        })
        return updated
      })
    }

    pc.onconnectionstatechange = () => {
      console.log(`connection with ${targetName}:`, pc.connectionState)
      if (pc.connectionState === "failed") {
        pc.restartIce()
      }
    }

    peerConnections.current.set(targetId, pc)
    return pc
  }

  function addLocalTracks(pc: RTCPeerConnection) {
    localStream.current?.getTracks().forEach(track => {
      pc.addTrack(track, localStream.current!)
    })
  }

  async function setupLocalStream() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })
      localStream.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
    } catch (err) {
      console.warn("camera not available:", err)
    }
  }

  function setupSocketListeners() {
    if (!socket.current) return

    // FIX 5 — renamed roomId to joinedRoomId to avoid shadowing
    socket.current.on("room-joined", async ({ existingParticipants, roomId: joinedRoomId, hostId }) => {
      console.log("room joined, existing participants:", existingParticipants)

      setHasJoined(true)
      setIsWaiting(false)
      setIsHost(socket.current?.id === hostId)
      setParticipants(existingParticipants)

      // store all existing participant names in ref
      existingParticipants.forEach((p: Participant) => {
        participantNames.current.set(p.socketId, p.name)
      })

      for (const participant of existingParticipants) {
        const pc = createPeerConnection(participant.socketId, participant.name)
        addLocalTracks(pc)

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        socket.current?.emit("offer", {
          offer,
          targetId: participant.socketId,
          roomId: joinedRoomId  // FIX 5 — use renamed variable
        })
      }
    })

    socket.current.on("participant-joined", ({ socketId, name }) => {
      console.log("participant joined:", name)
      // FIX 2 — store name in ref so offer handler can find it
      participantNames.current.set(socketId, name)
      setParticipants(prev => [...prev, { socketId, name }])
    })

    socket.current.on("offer", async ({ offer, fromId }) => {
      // FIX 2 — use ref instead of stale state
      const name = participantNames.current.get(fromId) || "Unknown"
      console.log("received offer from:", name)

      const pc = createPeerConnection(fromId, name)
      addLocalTracks(pc)

      await pc.setRemoteDescription(offer)

      // FIX 3 — apply queued ICE candidates after remote description is set
      const pending = pendingCandidates.current.get(fromId) || []
      for (const c of pending) await pc.addIceCandidate(c)
      pendingCandidates.current.delete(fromId)

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      socket.current?.emit("answer", {
        answer,
        targetId: fromId
      })
    })

    socket.current.on("answer", async ({ answer, fromId }) => {
      console.log("received answer from:", fromId)
      const pc = peerConnections.current.get(fromId)
      await pc?.setRemoteDescription(answer)

      // FIX 3 — apply queued ICE candidates after remote description is set
      const pending = pendingCandidates.current.get(fromId) || []
      for (const c of pending) await pc?.addIceCandidate(c)
      pendingCandidates.current.delete(fromId)
    })

    socket.current.on("ice-candidate", async ({ candidate, fromId }) => {
      const pc = peerConnections.current.get(fromId)
      if (pc?.remoteDescription) {
        await pc.addIceCandidate(candidate)
      } else {
        // FIX 3 — queue instead of dropping
        const existing = pendingCandidates.current.get(fromId) || []
        pendingCandidates.current.set(fromId, [...existing, candidate])
      }
    })

    socket.current.on("participant-left", ({ socketId }) => {
      console.log("participant left:", socketId)
      peerConnections.current.get(socketId)?.close()
      peerConnections.current.delete(socketId)
      participantNames.current.delete(socketId)  // clean up name too

      setRemoteStreams(prev => {
        const updated = new Map(prev)
        updated.delete(socketId)
        return updated
      })

      setParticipants(prev => prev.filter(p => p.socketId !== socketId))
    })

    socket.current.on("meeting-ended", () => {
      console.log("meeting ended by host")
      cleanup()
    })

    socket.current.on("join-denied", () => {
      setIsWaiting(false)
      setIsDenied(true)
    })

    socket.current.on("join-request", ({ socketId, name }) => {
      setWaitingList(prev => [...prev, { socketId, name }])
    })
  }

  async function createRoom(name: string, isRestricted: boolean) {
    if (!socket.current) return

    myName.current = name
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase()

    await setupLocalStream()
    setupSocketListeners()

    setIsHost(true)
    setHasJoined(true)

    socket.current.emit("create-room", {
      roomId: newRoomId,
      name,
      isRestricted
    })

    socket.current.on("room-created", ({ roomId }) => {
      console.log("room created:", roomId)
    })

    return newRoomId
  }

  async function joinRoom(name: string) {
    if (!socket.current) return

    myName.current = name

    await setupLocalStream()
    setupSocketListeners()

    socket.current.emit("join-room", { roomId, name })

    socket.current.on("waiting-for-approval", () => {
      setIsWaiting(true)
      console.log("waiting for host approval")
    })

    socket.current.on("room-not-found", () => {
      console.log("room not found")
      alert("Room not found. Check the room ID and try again.")
    })
  }

  function admitParticipant(socketId: string, roomId: string) {
    socket.current?.emit("approve-participant", { socketId, roomId })
    setWaitingList(prev => prev.filter(p => p.socketId !== socketId))
  }

  function denyParticipant(socketId: string, roomId: string) {
    socket.current?.emit("deny-participant", { socketId, roomId })
    setWaitingList(prev => prev.filter(p => p.socketId !== socketId))
  }

  function toggleMute() {
    localStream.current?.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled
    })
    setIsMuted(prev => !prev)
  }

  function toggleCamera() {
    localStream.current?.getVideoTracks().forEach(track => {
      track.enabled = !track.enabled
    })
    setIsCameraOff(prev => !prev)
  }

  // FIX 4 — cleanup now resets all refs
  function cleanup() {
    localStream.current?.getTracks().forEach(track => track.stop())
    peerConnections.current.forEach(pc => pc.close())
    peerConnections.current.clear()
    participantNames.current.clear()
    pendingCandidates.current.clear()
    setRemoteStreams(new Map())
    setParticipants([])
    setHasJoined(false)
  }

  function leaveRoom(roomId: string) {
    socket.current?.emit("leave-room", roomId)
    cleanup()
  }

  return {
     setLocalVideoRef,
    remoteStreams,
    participants,
    isHost,
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
  }
}