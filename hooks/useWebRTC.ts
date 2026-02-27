import { useRef, useState } from "react"
import { Socket } from "socket.io-client"

export function useWebRTC(
  socket: React.MutableRefObject<Socket | null>,
  roomId: string,
) {
  const localStream = useRef<MediaStream | null>(null)
  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([])

  // add these after your existing refs
const [isMuted, setIsMuted] = useState(false)
const [isCameraOff, setIsCameraOff] = useState(false)
const [hasjoined,setHasJoined]=useState(false);

  function createPeerConnection() {
        const pc = new RTCPeerConnection({
  iceServers: [
      {
        urls: "stun:stun.relay.metered.ca:80",
      },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: "edda0e2e776bdcd0dd7636a2",
        credential: "ATHSm/VP4WkWPnOW",
      },
      {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: "edda0e2e776bdcd0dd7636a2",
        credential: "ATHSm/VP4WkWPnOW",
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: "edda0e2e776bdcd0dd7636a2",
        credential: "ATHSm/VP4WkWPnOW",
      },
      {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: "edda0e2e776bdcd0dd7636a2",
        credential: "ATHSm/VP4WkWPnOW",
      },
  ],
});

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.current?.emit("ice-candidate", { candidate: event.candidate, roomId })
      }
    }
    pc.onicecandidateerror = (event) => {
  console.log("ICE candidate error:", event.errorCode, event.errorText, event.url)
}
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0]
      }
    }

    pc.onconnectionstatechange = () => {
      console.log("connection state:", pc.connectionState)
      if (pc.connectionState === "failed") {
    console.log("connection failed, restarting ICE...")
    pc.restartIce()
  }
    }

    pc.onicegatheringstatechange = () => {
      console.log("ice gathering state:", pc.iceGatheringState)
    }

    return pc
  }

  async function applyPendingCandidates() {
    for (const candidate of pendingCandidates.current) {
      await peerConnection.current?.addIceCandidate(candidate)
      console.log("applied pending candidate")
    }
    pendingCandidates.current = []
  }

  // this is the function the button calls
  async function joinRoom() {
    if (!socket.current) return
  
    // step 1 — tell server we're joining

    socket.current.emit("join-room", roomId)
    console.log("joined room:", roomId)

   setHasJoined(true);
    // step 3 — now set up all socket listeners
    // we do this here so they're only registered after the user joins
    socket.current.on("user-joined", async (userId: string) => {
      console.log("user joined, creating offer")
      peerConnection.current = createPeerConnection()
      console.log("Created Peer connection");
      console.log(peerConnection.current);
      localStream.current?.getTracks().forEach(track => {
        peerConnection.current?.addTrack(track, localStream.current!)
      })
      console.log("Emitting offer");
      const offer = await peerConnection.current.createOffer()
      await peerConnection.current.setLocalDescription(offer)
      socket.current?.emit("offer", { offer, roomId })
    })

    socket.current.on("offer", async ({ offer }) => {
      console.log("received offer, creating answer")
      peerConnection.current = createPeerConnection()
      localStream.current?.getTracks().forEach(track => {
        peerConnection.current?.addTrack(track, localStream.current!)
      })
      await peerConnection.current.setRemoteDescription(offer)
      await applyPendingCandidates()
      const answer = await peerConnection.current.createAnswer()
      await peerConnection.current.setLocalDescription(answer)
      socket.current?.emit("answer", { answer, roomId })
    })

    socket.current.on("answer", async ({ answer }) => {
      console.log("received answer")
      await peerConnection.current?.setRemoteDescription(answer)
      await applyPendingCandidates()
    })

    socket.current.on("ice-candidate", async ({ candidate }) => {
      if (peerConnection.current?.remoteDescription) {
        await peerConnection.current.addIceCandidate(candidate)
        console.log("added ice candidate immediately")
      } else {
        pendingCandidates.current.push(candidate)
        console.log("queued ice candidate, total:", pendingCandidates.current.length)
      }
    })

    socket.current.on("user-left", () => {
  console.log("other person left")

  // clear their video
  if (remoteVideoRef.current) {
    remoteVideoRef.current.srcObject = null
  }

  // close peer connection
  peerConnection.current?.close()
  peerConnection.current = null
})

     // step 2 — ask for camera AFTER joining
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStream.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
    } catch (err) {
      console.warn("camera not available:", err)
    }

  }
  function toggleMute() {
  if (!localStream.current) return

  // getAudioTracks() returns only the audio track
  localStream.current.getAudioTracks().forEach(track => {
    track.enabled = !track.enabled  // flip it
  })

  setIsMuted(prev => !prev)  // update UI state
}

function toggleCamera() {
  if (!localStream.current) return

  // getVideoTracks() returns only the video track
  localStream.current.getVideoTracks().forEach(track => {
    track.enabled = !track.enabled  // flip it
  })

  setIsCameraOff(prev => !prev)  // update UI state
}
function leaveRoom() {
  // stop all camera and mic tracks
  localStream.current?.getTracks().forEach(track => {
    track.stop()  // this turns off the camera light too
  })

  // close the peer connection
  peerConnection.current?.close()
  peerConnection.current = null

  // tell server we left
  socket.current?.emit("leave-room", roomId)

  // clear local video
  if (localVideoRef.current) {
    localVideoRef.current.srcObject = null
  }
}
  return { localVideoRef, remoteVideoRef, localStream, joinRoom,isCameraOff,isMuted,toggleCamera,toggleMute,hasjoined,leaveRoom };
}