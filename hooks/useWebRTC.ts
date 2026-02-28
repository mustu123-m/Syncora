import { useRef, useState } from "react"
import { Socket } from "socket.io-client"

// what we know about each participant
interface Participant {
  socketId: string
  name: string
}

export function useWebRTC(
  socket: React.MutableRefObject<Socket | null>,
  roomId: string,
) {
  // OUR camera stream
  const localStream = useRef<MediaStream | null>(null)

  // one peer connection per person, keyed by their socket ID
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())

  // our own video element
  const localVideoRef = useRef<HTMLVideoElement | null>(null)

  // remote streams — one per participant
  // this is STATE not a ref because changing it should update the UI
  const [remoteStreams, setRemoteStreams] = useState<Map<string, {
    stream: MediaStream
    name: string
  }>>(new Map())

  // track who is in the room
  const [participants, setParticipants] = useState<Participant[]>([])

  // are we the host?
  const [isHost, setIsHost] = useState(false)

  // have we joined yet?
  const [hasJoined, setHasJoined] = useState(false)

  // waiting for host approval?
  const [isWaiting, setIsWaiting] = useState(false)

  // were we denied?
  const [isDenied, setIsDenied] = useState(false)

  // people waiting to join (only host sees this)
  const [waitingList, setWaitingList] = useState<Participant[]>([])

  // our own name — stored so we can use it in events
  const myName = useRef<string>("")

  // TURN server config — same as before
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

  // creates a peer connection for a specific person
  // targetId = their socket ID
  // targetName = their display name
  function createPeerConnection(targetId: string, targetName: string) {
    const pc = new RTCPeerConnection(iceConfig)

    // when we find an ICE candidate, send it directly to that person
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.current?.emit("ice-candidate", {
          candidate: event.candidate,
          targetId  // send directly to this person
        })
      }
    }

    // when their video arrives, add it to our remoteStreams map
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

    // store it in our map
    peerConnections.current.set(targetId, pc)
    return pc
  }

  // adds our local tracks to a peer connection
  function addLocalTracks(pc: RTCPeerConnection) {
    localStream.current?.getTracks().forEach(track => {
      pc.addTrack(track, localStream.current!)
    })
  }

  // gets camera and mic
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

  // sets up all socket listeners
  // called after joining so we don't miss any events
  function setupSocketListeners() {
    if (!socket.current) return

    // server tells us who is already in the room
    // this fires right after we join
    socket.current.on("room-joined", async ({ existingParticipants,roomId, hostId }) => {
      console.log("room joined, existing participants:", existingParticipants)
  
      setHasJoined(true)
      setIsWaiting(false)
      setIsHost(socket.current?.id === hostId)
      setParticipants(existingParticipants)

      // create a peer connection with EACH existing participant
      // WE are the ones joining so WE send the offer to each person
      for (const participant of existingParticipants) {
        const pc = createPeerConnection(participant.socketId, participant.name)
        addLocalTracks(pc)

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        socket.current?.emit("offer", {
          offer,
          targetId: participant.socketId,  // send to this specific person
          roomId
        })
      }
    })

    // a new person joined the room
    // THEY will send us an offer, we just update our participant list
    socket.current.on("participant-joined", ({ socketId, name }) => {
      console.log("participant joined:", name)
      setParticipants(prev => [...prev, { socketId, name }])
    })

    // we received an offer from someone
    // create a peer connection with them and send back an answer
    socket.current.on("offer", async ({ offer, fromId }) => {
      // find this person's name from our participants list
      // we need it to label their video
      const participant = participants.find(p => p.socketId === fromId)
      const name = participant?.name || "Unknown"

      console.log("received offer from:", name)

      const pc = createPeerConnection(fromId, name)
      addLocalTracks(pc)

      await pc.setRemoteDescription(offer)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      socket.current?.emit("answer", {
        answer,
        targetId: fromId  // send answer back to the person who offered
      })
    })

    // we received an answer to our offer
    socket.current.on("answer", async ({ answer, fromId }) => {
      console.log("received answer from:", fromId)
      const pc = peerConnections.current.get(fromId)
      await pc?.setRemoteDescription(answer)
    })

    // we received an ICE candidate from someone
    socket.current.on("ice-candidate", async ({ candidate, fromId }) => {
      const pc = peerConnections.current.get(fromId)
      if (pc?.remoteDescription) {
        await pc.addIceCandidate(candidate)
      } else {
        // queue it — same race condition fix as before
        // but now per peer connection
        console.log("received ICE candidate before remote description from:", fromId)
      }
    })

    // someone left
    socket.current.on("participant-left", ({ socketId }) => {
      console.log("participant left:", socketId)

      // close their peer connection
      peerConnections.current.get(socketId)?.close()
      peerConnections.current.delete(socketId)

      // remove their video
      setRemoteStreams(prev => {
        const updated = new Map(prev)
        updated.delete(socketId)
        return updated
      })

      // remove from participants list
      setParticipants(prev => prev.filter(p => p.socketId !== socketId))
    })

    // host ended the meeting
    socket.current.on("meeting-ended", () => {
      console.log("meeting ended by host")
      cleanup()
    })

    // we were denied entry
    socket.current.on("join-denied", () => {
      setIsWaiting(false)
      setIsDenied(true)
    })

    // HOST ONLY — someone wants to join
    socket.current.on("join-request", ({ socketId, name }) => {
      setWaitingList(prev => [...prev, { socketId, name }])
    })
  }

  // HOST creates a room
  async function createRoom(name: string, isRestricted: boolean) {
    if (!socket.current) return

    myName.current = name

    // generate a random room ID
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase()

    await setupLocalStream()
    setupSocketListeners()

    setIsHost(true)
    setHasJoined(true)


    socket.current.emit("create-room", {
      roomId:newRoomId,
      name,
      isRestricted
    })

    // server confirms room created
    socket.current.on("room-created", ({ roomId }) => {
      console.log("room created:", roomId)
    })

    return newRoomId
  }

  // GUEST joins an existing room
  async function joinRoom(name: string) {
    if (!socket.current) return

    myName.current = name

    await setupLocalStream()
    setupSocketListeners()

    socket.current.emit("join-room", { roomId, name })

    // if restricted room, we'll get "waiting-for-approval"
    socket.current.on("waiting-for-approval", () => {
      setIsWaiting(true)
      console.log("waiting for host approval")
    })

    // if room not found
    socket.current.on("room-not-found", () => {
      console.log("room not found")
      alert("Room not found. Check the room ID and try again.")
    })
  }

  // HOST admits someone from waiting list
  function admitParticipant(socketId: string,roomId :string) {
    console.log(socket.current);
    console.log("RoomId is");
    console.log(roomId);
    socket.current?.emit("approve-participant", { socketId, roomId })
    console.log("Admitting Participant");
    setWaitingList(prev => prev.filter(p => p.socketId !== socketId))
  }

  // HOST denies someone from waiting list
  function denyParticipant(socketId: string,roomId:string) {
    socket.current?.emit("deny-participant", { socketId, roomId })
    setWaitingList(prev => prev.filter(p => p.socketId !== socketId))
  }

  // mute toggle — same as before
  const [isMuted, setIsMuted] = useState(false)
  function toggleMute() {
    localStream.current?.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled
    })
    setIsMuted(prev => !prev)
  }

  // camera toggle — same as before
  const [isCameraOff, setIsCameraOff] = useState(false)
  function toggleCamera() {
    localStream.current?.getVideoTracks().forEach(track => {
      track.enabled = !track.enabled
    })
    setIsCameraOff(prev => !prev)
  }

  // clean up everything
  function cleanup() {
    localStream.current?.getTracks().forEach(track => track.stop())
    peerConnections.current.forEach(pc => pc.close())
    peerConnections.current.clear()
    setRemoteStreams(new Map())
    setParticipants([])
    setHasJoined(false)
  }

  // leave the room
  function leaveRoom(roomId:string) {
    socket.current?.emit("leave-room", roomId)
    cleanup()
  }

  return {
    localVideoRef,
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