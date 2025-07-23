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
const User=require('./models/User');
main().then(()=>{
  console.log("MongoDb Connected");
})
.catch(err => console.log(err));

async function main() {
  await mongoose.connect(process.env.MONGO_URL);

  // use `await mongoose.connect('mongodb://user:password@127.0.0.1:27017/test');` if your database has auth enabled
}
const app=express();
// 💾 Session Store
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

const server = http.createServer(app);
const io = new Server(server, {
  path: '/socket.io',
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/'
});
app.use('/peerjs', peerServer);
// 🔐 Auth + Routes
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(authRoute);
app.use(roomRoutes);
app.get("/dashboard",async (req,resp)=>{
  const user=await User.findById(req.session.userId);
  resp.render('dashboard',{user});
})

const rooms = {};  // roomId -> { hostId, users: { userId: userName } }

io.on('connection', socket => {
   const hostSockets = {};

  socket.on('host-ready', (roomId, userId, userName) => {
    if (!rooms[roomId]) {
      rooms[roomId] = {
        hostId: userId,
        users: {},
        requireApproval: true // Make sure this matches your room creation logic
      };
    }
    rooms[roomId].hostId = userId;
    rooms[roomId].users[userId] = userName;
    socket.join(roomId);
    socket.data = { userId, userName, roomId, isHost: true };
    hostSockets[roomId] = socket.id; // Track host socket by room
  });
 socket.on('request-join', (roomId, userId, userName, isHost, requireApproval) => {
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
        io.to(hostSocketId).emit('join-request', { userId, userName });
        socket.data = { pendingApproval: true, roomId, userId, userName };
      } else {
        socket.emit('no-host-available');
      }
    } else {
      // Auto-approval logic
      room.users[userId] = userName;
      socket.join(roomId);
      socket.data = { userId, userName, roomId, isHost: false };
      socket.emit('user-approved', { approved: true, isHost: false });
      io.to(roomId).emit('user-connected', { userId, userName });
    }
  });


  socket.on('approve-user', ({ roomId, userId, userName }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.users[userId] = userName;
    const targetSocket = [...io.sockets.sockets.values()].find(s => s.data?.pending?.userId === userId);
    if (targetSocket) {
      targetSocket.join(roomId);
      targetSocket.emit('user-approved', { approved: true, isHost: false });

      io.to(roomId).emit('user-connected', { userId, userName });
      const users = Object.entries(room.users).map(([id, name]) => ({ userId: id, userName: name }));
      targetSocket.emit('existing-users', users);
    }
  });

  socket.on('join-room', (roomId, userId, userName) => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = { hostId: userId, users: {} };
    rooms[roomId].users[userId] = userName;
    socket.to(roomId).emit('user-connected', { userId, userName });
  });

socket.on('disconnecting', () => {
  const { userId, roomId, isHost } = socket.data || {};
  if (!roomId || !rooms[roomId]) return;

  delete rooms[roomId].users[userId];
  socket.to(roomId).emit('user-disconnected', userId);

  if (isHost) {
    // notify all and clean up
    io.to(roomId).emit('meeting-ended');
    delete rooms[roomId];
  }
});
  socket.on('chat-message', ({ roomId, userId, userName, message }) => {
    socket.to(roomId).emit('chat-message', { userName, message });
  });

  socket.on('reaction', ({ roomId, userId, userName, reaction }) => {
    io.to(roomId).emit('reaction', { userName, reaction });
  });
  socket.on('ready', () => {
  const roomId = socket.roomId;

  if (!roomId || !rooms[roomId]) return;

  // Notify all other users in the room about the new user
  socket.to(roomId).emit('user-connected', socket.userId);
});

});

server.listen(5000, () => console.log('🚀 Server running on port 5000'));
