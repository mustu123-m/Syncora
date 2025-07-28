require('dotenv').config();
const express = require('express');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const { ExpressPeerServer } = require('peer');
const authRoute = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const { requireLogin } = require('./middleware/authMiddleware');
const User = require('./models/User');

main().then(() => {
  console.log("MongoDB Connected");
}).catch(err => console.log(err));

async function main() {
  await mongoose.connect(process.env.MONGO_URL);
}

const app = express();
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URL,
    collectionName: 'sessions'
  }),
  cookie: { maxAge: 24 * 60 * 60 * 1000, secure: false }
}));

// const server = http.createServer(app);
// const io = new Server(server, {
//   path: '/socket.io',
//   cors: {
//     origin: '*',
//     methods: ['GET', 'POST']
//   }
// });
// const peerServer = ExpressPeerServer(server, {
//   debug: true,
//   path: '/peerjs' ,
//    allow_discovery: true
// });
const server = http.createServer(app);
const io = new Server(server, {
  path: '/socket.io',
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'] // Added transports
});

// Updated PeerJS server configuration
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/', // Changed path to '/peerjs'
  proxied: true // Added for Render.com
});
app.use('/peerjs', peerServer);
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(authRoute);
app.use(roomRoutes);

app.get("/dashboard", async (req, res) => {
  const user = await User.findById(req.session.userId);
  res.render('dashboard', { user });
});

const rooms = {};
const hostSockets = {};

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  socket.on('host-ready', (roomId, userId, userName) => {
    console.log(`Host ready for room ${roomId}: ${userId}`);
    if (!rooms[roomId]) {
      rooms[roomId] = {
        hostId: userId,
        users: {},
        requireApproval: true
      };
    }
    rooms[roomId].hostId = userId;
    rooms[roomId].users[userId] = userName;
    socket.join(roomId);
    socket.data = { userId, userName, roomId, isHost: true };
    hostSockets[roomId] = socket.id;
    console.log(`Registered host socket ID for ${roomId}: ${socket.id}`);
  });

  socket.on('request-join', (roomId, userId, userName, isHost, requireApproval) => {
    console.log(`Join request for room ${roomId} from ${userId}`);
    const room = rooms[roomId];
    
    if (!room) {
      return socket.emit('room-not-found');
    }

    if (isHost) {
      return socket.emit('invalid-request', 'Hosts should use host-ready');
    }

    if (room.requireApproval) {
      const hostSocketId = hostSockets[roomId];
      if (hostSocketId) {
        console.log(`Forwarding join request to host ${hostSocketId}`);
        io.to(hostSocketId).emit('join-request', { userId, userName });
        socket.data = { pendingApproval: true, roomId, userId, userName };
      } else {
        console.log(`No host available for room ${roomId}`);
        socket.emit('no-host-available');
      }
    } else {
      room.users[userId] = userName;
      socket.join(roomId);
      socket.data = { userId, userName, roomId, isHost: false };
      socket.emit('user-approved', { approved: true, isHost: false });
      io.to(roomId).emit('user-connected', { userId, userName });
    }
  });

  socket.on('approve-user', ({ roomId, userId, userName }) => {
    console.log(`Approving user ${userId} for room ${roomId}`);
    const room = rooms[roomId];
    if (!room || socket.id !== hostSockets[roomId]) {
      return console.log('Unauthorized approval attempt');
    }

    room.users[userId] = userName;
    const targetSocket = [...io.sockets.sockets.values()].find(
      s => s.data?.pendingApproval && s.data.userId === userId
    );

    if (targetSocket) {
      targetSocket.join(roomId);
      targetSocket.data.pendingApproval = false;
      targetSocket.emit('user-approved', { approved: true, isHost: false });
      io.to(roomId).emit('user-connected', { userId, userName });
      
      const users = Object.entries(room.users).map(([id, name]) => ({ 
        userId: id, 
        userName: name 
      }));
      targetSocket.emit('existing-users', users);
    }
  });

  socket.on('disconnecting', () => {
    const { userId, roomId, isHost } = socket.data || {};
    if (!roomId || !rooms[roomId]) return;

    delete rooms[roomId].users[userId];
    socket.to(roomId).emit('user-disconnected', userId);

    if (isHost) {
      io.to(roomId).emit('meeting-ended');
      delete rooms[roomId];
      delete hostSockets[roomId];
    }
  });

  socket.on('chat-message', ({ roomId, userId, userName, message }) => {
    socket.to(roomId).emit('chat-message', { userName, message });
  });

socket.on('reaction', ({ userName, reaction }) => {
  socket.to(roomId).emit('reaction', { userName, reaction });
});

  socket.on('end-meeting', (roomId) => {
  io.to(roomId).emit('meeting-ended');
});

});

server.listen(5000, () => console.log('🚀 Server running on port 5000'));
