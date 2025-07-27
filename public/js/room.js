const userNamesMap = {};
const connectedPeers = {};
const connectedUsers = {};
const videoElements = {};

let socket;
let localStream, originalVideoTrack, originalAudioTrack;
let screenSharing = false;// === Control Buttons ===
const muteBtn = document.getElementById('muteBtn');
const videoBtn = document.getElementById('videoBtn');
const leaveBtn = document.getElementById('leaveBtn');
const raiseHandBtn = document.getElementById('raiseHandBtn');
const reactionBtn = document.getElementById('reactionBtn');
const screenShareBtn = document.getElementById('screenShareBtn');

let audioEnabled = true;
let videoEnabled = true;
let screenStream;

// Mute/Unmute Button

// Screen Sharing Toggle
screenShareBtn.addEventListener('click', async () => {
  if (!screenSharing) {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      Object.values(peers).forEach(peer => {
        const sender = peer.peerConnection.getSenders().find(s => s.track.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      });
      screenTrack.onended = () => {
        stopScreenShare();
      };
      screenSharing = true;
      screenShareBtn.innerText = 'Stop Sharing';
    } catch (e) {
      console.error('Screen share error:', e);
    }
  } else {
    stopScreenShare();
  }
});

function stopScreenShare() {
  const videoTrack = myVideoStream.getVideoTracks()[0];
  Object.values(peers).forEach(peer => {
    const sender = peer.peerConnection.getSenders().find(s => s.track.kind === 'video');
    if (sender) sender.replaceTrack(videoTrack);
  });
  screenStream.getTracks().forEach(track => track.stop());
  screenSharing = false;
  screenShareBtn.innerText = 'Share Screen';
}

// Chat/reaction message display helper
function appendMessage(msg) {
  const msgBox = document.getElementById('messages');
  const li = document.createElement('li');
  li.innerText = msg;
  msgBox.appendChild(li);
  msgBox.scrollTop = msgBox.scrollHeight;
}



const peer = new Peer(undefined, {
  host: window.location.hostname,
  port: window.location.port || (window.location.protocol === 'https:' ? 443 : 80),
  path: '/peerjs',
  secure: window.location.protocol === 'https:'
});

const myVideo = document.createElement('video');
myVideo.muted = true;

const videoGrid = document.getElementById('video-grid');
const userList = document.getElementById('user-list');
const shareBtn = document.getElementById('share-screen-btn');
const chatInput = document.getElementById('chat-input');
const messagesDiv = document.getElementById('messages');

peer.on('open', id => {
  if (!my_username) my_username = `User-${id.slice(0, 4)}`;
  userNamesMap[id] = my_username;

  socket = io(window.location.origin, {
    path: '/socket.io',
    transports: ['websocket']
  });

  // Debugging
  console.log(`Peer connected as ${isHost ? 'HOST' : 'guest'}`);
  console.log(`Room ID: ${ROOM_ID}, Username: ${my_username}`);

  socket.on('connect', () => {
    console.log('Socket.IO connected:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('Socket.IO disconnected');
  });

  socket.on('connect_error', (err) => {
    console.error('Socket.IO connection error:', err);
  });

  if (isHost) {
    document.getElementById('meeting-ui').style.display = 'block';
    document.getElementById('waiting-room').style.display = 'none';
    socket.emit('host-ready', ROOM_ID, peer.id, my_username);
  } else {
    document.getElementById('meeting-ui').style.display = 'none';
    document.getElementById('waiting-room').style.display = 'block';
    socket.emit('request-join', ROOM_ID, peer.id, my_username, isHost, requireApproval);
  }

  socket.on('join-request', ({ userId, userName }) => {
    if (isHost) {
      console.log(`Received join request from ${userName} (${userId})`);
      showJoinRequestPopup(userId, userName);
    }
  });

  socket.on('existing-users', users => {
    users.forEach(({ userId, userName }) => {
      addUserToList(userId, userName);
      setTimeout(() => connectToNewUser(userId, localStream), 500);
    });
  });

  socket.on('user-connected', ({ userId, userName }) => {
    addUserToList(userId, userName);
    setTimeout(() => connectToNewUser(userId, localStream), 500);
  });

  socket.on('user-disconnected', userId => {
    removeUserFromList(userId);
    removeVideo(userId);
    connectedPeers[userId]?.close();
    delete connectedPeers[userId];
  });

  socket.on('meeting-ended', () => {
    alert('🚫 Meeting has ended.');
    window.location.href = '/dashboard';
  });

  socket.on('chat-message', ({ userName, message }) => {
    appendMessage(`💬 ${userName}: ${message}`);
  });

  socket.on('reaction', ({ userName, reaction }) => {
    appendMessage(`🎉 ${userName} reacted with ${reaction}`);
  });

  socket.on('user-approved', ({ approved, isHost: hostStatus }) => {
    if (!approved) {
      alert("❌ Access denied by host.");
      return window.location.href = '/dashboard';
    }

    isHost = hostStatus;
    console.log("Host approved. Showing your video now.");
    
    if (!myVideo.srcObject) {
      myVideo.muted = true;
      myVideo.autoplay = true;
      myVideo.playsInline = true;
    }

    if (localStream) {
      addVideoStream(myVideo, localStream, peer.id);
    } else {
      console.error("No local stream available when approved");
    }
    
    document.getElementById('meeting-ui').style.display = 'block';
    document.getElementById('waiting-room').style.display = 'none';
    socket.emit('join-room', ROOM_ID, peer.id, my_username);
  });
});

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    originalVideoTrack = stream.getVideoTracks()[0];
    originalAudioTrack = stream.getAudioTracks()[0];
    console.log("Got local stream from camera:", stream);

    if (isHost) {
      console.log("You are the host. Showing your video immediately.");
      addVideoStream(myVideo, stream, peer.id);
    }
  })
  .catch(err => {
    console.error("Failed to access webcam/mic", err);
    alert("Could not access camera/microphone. Please check permissions.");
  });

peer.on('call', call => {
  call.answer(localStream);
  const video = document.createElement('video');
  call.on('stream', stream => {
    console.log(`Received stream from ${call.peer}`, stream);
    addVideoStream(video, stream, call.peer);
    connectedPeers[call.peer] = call;
  });
  call.on('close', () => removeVideo(call.peer));
});

function connectToNewUser(userId, stream) {
  if (connectedPeers[userId]) return;
  const call = peer.call(userId, stream);
  if (!call) return;

  const video = document.createElement('video');
  call.on('stream', userStream => {
    addVideoStream(video, userStream, userId);
    connectedPeers[userId] = call;
  });
  call.on('close', () => removeVideo(userId));
}

function addVideoStream(videoEl, stream, userId) {
  console.log("Adding video stream for:", userId);
  let container = videoElements[userId];
  
  if (!container) {
    container = document.createElement('div');
    container.className = 'video-container';
    videoElements[userId] = container;
    
    if (!videoEl) {
      videoEl = document.createElement('video');
      videoEl.muted = (userId === peer.id);
    }
    
    const nameTag = document.createElement('div');
    nameTag.className = 'name-label';
    nameTag.innerText = userNamesMap[userId] || userId;
    
    container.appendChild(videoEl);
    container.appendChild(nameTag);
    videoGrid.appendChild(container);
  }

  videoEl.srcObject = stream;
  
  if (videoEl.readyState >= 1) {
    videoEl.play().catch(err => console.warn("Play error:", err));
  } else {
    videoEl.onloadedmetadata = () => {
      videoEl.play().catch(err => console.warn("Play error:", err));
    };
  }

  updateGridLayout();
}

function removeVideo(userId) {
  const container = videoElements[userId];
  if (!container) return;
  const video = container.querySelector('video');
  if (video) {
    video.pause();
    video.srcObject?.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
  container.remove();
  delete videoElements[userId];
  updateGridLayout();
}

function updateGridLayout() {
  const count = Object.keys(videoElements).length;
  const grid = document.getElementById('video-grid');
  grid.style.gridTemplateColumns = count <= 1 ? '1fr' :
    count === 2 ? '1fr 1fr' :
    count <= 4 ? '1fr 1fr' :
    count <= 6 ? '1fr 1fr 1fr' :
    count <= 9 ? '1fr 1fr 1fr' : '1fr 1fr 1fr 1fr';
}

function addUserToList(userId, name) {
  if (connectedUsers[userId]) return;
  userNamesMap[userId] = name;
  const li = document.createElement('li');
  li.id = `user-${userId}`;
  li.innerText = `👤 ${name}`;
  userList.appendChild(li);
  connectedUsers[userId] = li;
}

function removeUserFromList(userId) {
  connectedUsers[userId]?.remove();
  delete connectedUsers[userId];
}

function showJoinRequestPopup(userId, userName) {
  const existingModals = document.querySelectorAll('.join-request-modal');
  existingModals.forEach(modal => modal.remove());

  const modal = document.createElement('div');
  modal.className = 'join-request-modal fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[1000]';
  modal.innerHTML = `
    <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
      <h3 class="text-xl font-bold mb-4">Join Request</h3>
      <p class="mb-6">User <span class="font-semibold">${userName}</span> wants to join the meeting.</p>
      <div class="flex justify-end space-x-3">
        <button id="deny-btn" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition">
          Deny
        </button>
        <button id="allow-btn" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition">
          Allow
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('allow-btn').addEventListener('click', () => {
    socket.emit('approve-user', { roomId: ROOM_ID, userId, userName });
    modal.remove();
  });

  document.getElementById('deny-btn').addEventListener('click', () => {
    socket.emit('deny-user', { roomId: ROOM_ID, userId });
    modal.remove();
  });

  setTimeout(() => {
    if (document.body.contains(modal)) {
      socket.emit('deny-user', { roomId: ROOM_ID, userId });
      modal.remove();
    }
  }, 30000);
}

// Rest of your UI event handlers remain the same..
muteBtn.addEventListener('click', () => {
  audioEnabled = !audioEnabled;
  myVideoStream.getAudioTracks()[0].enabled = audioEnabled;
  muteBtn.innerHTML = audioEnabled ? 'Mute' : 'Unmute';
});

// Start/Stop Video
videoBtn.addEventListener('click', () => {
  videoEnabled = !videoEnabled;
  myVideoStream.getVideoTracks()[0].enabled = videoEnabled;
  videoBtn.innerHTML = videoEnabled ? 'Stop Video' : 'Start Video';
});

// Leave Button
leaveBtn.addEventListener('click', () => {
  window.location.href = '/'; // or a custom leave handler
});

// Raise Hand Button
raiseHandBtn.addEventListener('click', () => {
  socket.emit('raise-hand', username);
  appendMessage(`✋ ${username} raised their hand`);
});

// Reaction Button (e.g., send a 👍)
reactionBtn.addEventListener('click', () => {
  const emoji = '👍';
  socket.emit('reaction', { emoji, username });
  appendMessage(`${username}: ${emoji}`);
});

