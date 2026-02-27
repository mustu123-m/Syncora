import { createServer } from "http"
import { parse } from "url"
import next from "next"
import { Server } from "socket.io"

const dev = process.env.NODE_ENV !== "production"
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  const io = new Server(httpServer, {
    cors: { origin: "*" }
  })

  // tracks all active rooms
  // key = roomId, value = room info
  const rooms = new Map<string, {
    hostId: string          // socket ID of the host
    isRestricted: boolean   // true = need host approval
    participants: Map<string, string>  // socketId → name
    waiting: Map<string, string>       // socketId → name (waiting for approval)
  }>()

  io.on("connection", (socket) => {
    console.log("connected:", socket.id)

    // HOST creates a new room
    // data = { roomId, name, isRestricted }
    socket.on("create-room", ({ roomId, name, isRestricted }) => {
      // create the room with host info
      rooms.set(roomId, {
        hostId: socket.id,
        isRestricted,
        participants: new Map([[socket.id, name]]),
        waiting: new Map()
      })

      // host joins the socket room
      socket.join(roomId)
      console.log(`${name} created room ${roomId}, restricted: ${isRestricted}`)

      // confirm to host that room is created
      socket.emit("room-created", { roomId })
    })

    // GUEST tries to join a room
    // data = { roomId, name }
    socket.on("join-room", ({ roomId, name }) => {
      const room = rooms.get(roomId)

      // room doesn't exist
      if (!room) {
        socket.emit("room-not-found")
        return
      }

      if (room.isRestricted) {
        // add to waiting list
        room.waiting.set(socket.id, name)

        // tell the guest they're waiting
        socket.emit("waiting-for-approval")

        // tell the host someone is waiting
        // send socket ID so host can approve/deny by ID
        io.to(room.hostId).emit("join-request", {
          socketId: socket.id,
          name
        })

        console.log(`${name} is waiting to join ${roomId}`)
      } else {
        // open room — let them in immediately
        admitParticipant(socket, roomId, name, room)
      }
    })

    // HOST approves a waiting guest
    // data = { socketId, roomId }
    socket.on("approve-participant", ({ socketId, roomId }) => {
      const room = rooms.get(roomId)
      console.log("Approving Participant")
      if (!room) return;
      console.log("approving>>>");
      
      const name = room.waiting.get(socketId)
      if (!name) return

      // remove from waiting list
      room.waiting.delete(socketId)

      // get the guest's socket and admit them
      const guestSocket = io.sockets.sockets.get(socketId)
      console.log(guestSocket);
      if (guestSocket) {
        admitParticipant(guestSocket, roomId, name, room)
      }
    })

    // HOST denies a waiting guest
    // data = { socketId, roomId }
    socket.on("deny-participant", ({ socketId, roomId }) => {
      const room = rooms.get(roomId)
      if (!room) return

      // remove from waiting list
      room.waiting.delete(socketId)

      // tell the guest they were denied
      io.to(socketId).emit("join-denied")

      console.log(`${socketId} was denied entry to ${roomId}`)
    })

    // WebRTC signaling — just forward to the right person
    // data includes targetId so we know who to send to
    socket.on("offer", ({ offer, targetId, roomId }) => {
      io.to(targetId).emit("offer", {
        offer,
        fromId: socket.id
      })
    })

    socket.on("answer", ({ answer, targetId }) => {
      io.to(targetId).emit("answer", {
        answer,
        fromId: socket.id
      })
    })

    socket.on("ice-candidate", ({ candidate, targetId }) => {
      io.to(targetId).emit("ice-candidate", {
        candidate,
        fromId: socket.id
      })
    })

    // someone leaves the room
    socket.on("leave-room", (roomId: string) => {
      handleLeave(socket.id, roomId)
    })

    // browser closes without clicking leave
    socket.on("disconnect", () => {
      // check all rooms and remove this socket
      rooms.forEach((room, roomId) => {
        if (room.participants.has(socket.id) || room.waiting.has(socket.id)) {
          handleLeave(socket.id, roomId)
        }
      })
      console.log("disconnected:", socket.id)
    })
  })

  // helper function — admit a participant into a room
  function admitParticipant(
    socket: any,
    roomId: string,
    name: string,
    room: any
  ) {
    // add to participants
    room.participants.set(socket.id, name)

    // join the socket room
    socket.join(roomId)

    // tell the new person:
    // 1. they're admitted
    // 2. list of everyone already in the room
  const existingParticipants = Array.from(
  room.participants as Map<string, string>
).filter(([id]) => id !== socket.id)
 .map(([id, name]) => ({ socketId: id, name }))
 console.log("Emitting room-joined");

    socket.emit("room-joined", {
      existingParticipants,
      roomId,
      hostId: room.hostId
    })

    // tell everyone else a new person joined
    socket.to(roomId).emit("participant-joined", {
      socketId: socket.id,
      name
    })

    console.log(`${name} joined room ${roomId}`)
  }

  // helper function — handle someone leaving
  function handleLeave(socketId: string, roomId: string) {
    const room = rooms.get(roomId)
    if (!room) return

    const name = room.participants.get(socketId)

    // remove from participants
    room.participants.delete(socketId)
    room.waiting.delete(socketId)

    // tell everyone they left
    io.to(roomId).emit("participant-left", { socketId })

    // if host left, end the meeting for everyone
    if (room.hostId === socketId) {
      io.to(roomId).emit("meeting-ended")
      rooms.delete(roomId)
      console.log(`Host left, room ${roomId} closed`)
    }

    // if room is empty, clean it up
    if (room.participants.size === 0) {
      rooms.delete(roomId)
    }

    console.log(`${name} left room ${roomId}`)
  }

  httpServer.listen(3000, () => {
    console.log("Server running on http://localhost:3000")
  })
})