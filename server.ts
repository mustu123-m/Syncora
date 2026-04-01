import { createServer } from "http"
import { parse } from "url"
import next from "next"
import { Server } from "socket.io"

console.log("Starting Syncora server...")
console.log("PORT:", process.env.PORT)

const dev = process.env.NODE_ENV !== "production"
const app = next({ dev })
const handle = app.getRequestHandler()

const port = parseInt(process.env.PORT || "3000", 10)

app.prepare()
.then(() => {

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  })

  // tracks all active rooms
  const rooms = new Map<string, {
    hostId: string
    isRestricted: boolean
    participants: Map<string, string>
    waiting: Map<string, string>
  }>()

  io.on("connection", (socket) => {
    console.log("connected:", socket.id)

    socket.on("create-room", ({ roomId, name, isRestricted }) => {
      rooms.set(roomId, {
        hostId: socket.id,
        isRestricted,
        participants: new Map([[socket.id, name]]),
        waiting: new Map()
      })

      socket.join(roomId)
      socket.emit("room-created", { roomId })

      console.log(`${name} created room ${roomId}`)
    })

    socket.on("join-room", ({ roomId, name }) => {
      const room = rooms.get(roomId)

      if (!room) {
        socket.emit("room-not-found")
        return
      }

      if (room.isRestricted) {
        room.waiting.set(socket.id, name)

        socket.emit("waiting-for-approval")

        io.to(room.hostId).emit("join-request", {
          socketId: socket.id,
          name
        })
      } else {
        admitParticipant(socket, roomId, name, room)
      }
    })

    socket.on("approve-participant", ({ socketId, roomId }) => {
      const room = rooms.get(roomId)
      if (!room) return

      const name = room.waiting.get(socketId)
      if (!name) return

      room.waiting.delete(socketId)

      const guestSocket = io.sockets.sockets.get(socketId)
      if (guestSocket) {
        admitParticipant(guestSocket, roomId, name, room)
      }
    })

    socket.on("deny-participant", ({ socketId, roomId }) => {
      const room = rooms.get(roomId)
      if (!room) return

      room.waiting.delete(socketId)
      io.to(socketId).emit("join-denied")
    })

    socket.on("offer", ({ offer, targetId }) => {
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

    socket.on("leave-room", (roomId: string) => {
      handleLeave(socket.id, roomId)
    })

    socket.on("disconnect", () => {
      rooms.forEach((room, roomId) => {
        if (
          room.participants.has(socket.id) ||
          room.waiting.has(socket.id)
        ) {
          handleLeave(socket.id, roomId)
        }
      })

      console.log("disconnected:", socket.id)
    })
  })

  function admitParticipant(
    socket: any,
    roomId: string,
    name: string,
    room: any
  ) {
    room.participants.set(socket.id, name)

    socket.join(roomId)

    const existingParticipants = Array.from(
      room.participants
    )
      .filter(([id]) => id !== socket.id)
      .map(([id, name]) => ({ socketId: id, name }))

    socket.emit("room-joined", {
      existingParticipants,
      roomId,
      hostId: room.hostId
    })

    socket.to(roomId).emit("participant-joined", {
      socketId: socket.id,
      name
    })

    console.log(`${name} joined room ${roomId}`)
  }

  function handleLeave(socketId: string, roomId: string) {
    const room = rooms.get(roomId)
    if (!room) return

    const name = room.participants.get(socketId)

    room.participants.delete(socketId)
    room.waiting.delete(socketId)

    io.to(roomId).emit("participant-left", { socketId })

    if (room.hostId === socketId) {
      io.to(roomId).emit("meeting-ended")
      rooms.delete(roomId)
    }

    if (room.participants.size === 0) {
      rooms.delete(roomId)
    }

    console.log(`${name} left room ${roomId}`)
  }

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${port}`)
  })

})
.catch((err) => {
  console.error("Server failed to start:", err)
})