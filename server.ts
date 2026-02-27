// server.ts

import { createServer } from "http"        // Node.js built-in - creates a basic HTTP server
import { parse } from "url"                // Node.js built-in - helps read the URL of incoming requests
import next from "next"                    // Next.js itself
import { Server } from "socket.io"        // Socket.IO server

// This tells Next.js: are we in development or production?
// In dev, it shows detailed errors. In prod, it's optimized.
const dev = process.env.NODE_ENV !== "production"

// This creates the Next.js app — but doesn't start it yet
const app = next({ dev })

// This is Next.js's internal function that handles page requests
// Think of it as: "whatever URL the browser visits, Next.js figures out what to show"
const handle = app.getRequestHandler()

// app.prepare() gets Next.js ready (compiles pages etc.)
// It returns a Promise, so we use .then() to run code after it's ready
app.prepare().then(() => {

  // Now we create the actual HTTP server
  // Every time a browser makes a request, this function runs
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)  // read the URL
    handle(req, res, parsedUrl)              // let Next.js handle it
  })

  // We attach Socket.IO ON TOP of the same HTTP server
  // So port 3000 handles BOTH normal pages AND socket connections
  const io = new Server(httpServer, {
    cors: { origin: "*" }  // allow connections from any origin (fine for dev)
  })

  // This runs every time a new browser tab connects
  io.on("connection", (socket) => {
    // socket = this specific user's connection
    // Each user gets a unique socket.id automatically
    console.log("someone connected:", socket.id)

    // When this user sends a "join-room" message with a roomId
    socket.on("join-room", (roomId: string) => {
      // socket.join() puts this user into a named group
      // Now you can send messages to everyone in that group
      socket.join(roomId)

      // socket.to(roomId) means "everyone in this room EXCEPT the sender"
      // .emit() sends a message to them
      socket.to(roomId).emit("user-joined", socket.id)

      console.log(`${socket.id} joined room: ${roomId}`)
    })

    // This fires when the user closes the tab or loses connection
    socket.on("disconnect", () => {
      console.log("someone disconnected:", socket.id)
    })

    socket.on("offer", (data) => {
      console.log("Sending Offer");
  socket.to(data.roomId).emit("offer", data)
})

socket.on("answer", (data) => {
  socket.to(data.roomId).emit("answer", data)
})

socket.on("ice-candidate", (data) => {
  socket.to(data.roomId).emit("ice-candidate", data)
})
  })

  // Start listening on port 3000
  httpServer.listen(3000, () => {
    console.log("Server running on http://localhost:3000")
  })
})