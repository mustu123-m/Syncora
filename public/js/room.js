const userNamesMap = {};
const connectedPeers = {};
const connectedUsers = {};
const videoElements = {};
let localStream, originalVideoTrack, originalAudioTrack;
let screenSharing = false;
let screenStream;
let audioEnabled = true;
let videoEnabled = true;

const muteBtn = document.getElementById('mute-btn');
const videoBtn = document.getElementById('video-btn');
const leaveBtn = document.getElementById('leave-btn');
const screenShareBtn = document.getElementById('share-screen-btn');
const reactionButtons = document.querySelectorAll('.reaction-btn');

const videoGrid = document.getElementById('video-grid');
const userList = document.getElementById('user-list');
const chatInput = document.getElementById('chat-input');
const messagesDiv = document.getElementById('messages');

// const peer = new Peer(undefined, {
//   host: window.location.hostname,
//   port: window.location.protocol === 'https:' ? 443 : 80,
//   path: '/peerjs',
//   secure: window.location.protocol === 'https:'
// });
const peer = new Peer(undefined, {
  host: window.location.hostname,
  path: '/peerjs', // Changed to match server
  secure: window.location.protocol === 'https:',
  port: window.location.protocol === 'https:' ? 443 : 80
});

// [Keep all your existing event handlers and functions exactly as they were]
// Only the PeerJS configuration above was changed

// Add error handling for PeerJS
peer.on('error', (err) => {
  console.error('PeerJS error:', err);
  if (err.type === 'unavailable-id') {
    console.log('Peer ID was taken, retrying...');
    peer.reconnect();
  }
});

const myVideo = document.createElement('video');
myVideo.muted = true;

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    originalVideoTrack = stream.getVideoTracks()[0];
    originalAudioTrack = stream.getAudioTracks()[0];
    if (isHost) addVideoStream(myVideo, stream, peer.id);
  })
  .catch(err => {
    alert("🎥 Could not access camera/microphone. Check permissions.");
    console.error(err);
  });
const socket = io(window.location.origin, {
  path: '/socket.io',
  // transports: ['websocket']
});
peer.on('open', id => {
  userNamesMap[id] = my_username;

  if (isHost) {
    document.getElementById('meeting-ui').style.display = 'block';
    console.log("Emitting host-ready", ROOM_ID, peer.id, my_username);
    socket.emit('host-ready', ROOM_ID, id, my_username);
  } else {
    document.getElementById('waiting-room').style.display = 'block';
    console.log(my_username);
    socket.emit('request-join', ROOM_ID, id, my_username, isHost, requireApproval);
  }

  socket.on('user-approved', ({ approved, isHost: hostStatus }) => {
    if (!approved) {
      alert("❌ Access denied by host.");
      return window.location.href = '/dashboard';
    }
    isHost = hostStatus;
    addVideoStream(myVideo, localStream, peer.id);
    document.getElementById('meeting-ui').style.display = 'block';
    document.getElementById('waiting-room').style.display = 'none';
    socket.emit('join-room', ROOM_ID, peer.id, my_username);
  });

  socket.on('join-request', ({ userId, userName }) => {
    showJoinRequestPopup(userId, userName);
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
    alert("🚫 Meeting has ended.");
    window.location.href = '/dashboard';
  });

  socket.on('chat-message', ({ userName, message }) => {
    appendMessage(`💬 ${userName}: ${message}`);
  });

  socket.on('reaction', ({ ROOM_ID,userName, reaction }) => {
    appendMessage(`🎉 ${userName} reacted with ${reaction}`);
  });
});

peer.on('call', call => {
  call.answer(localStream);
  const video = document.createElement('video');
  call.on('stream', stream => {
    addVideoStream(video, stream, call.peer);
    connectedPeers[call.peer] = call;
  });
  call.on('close', () => removeVideo(call.peer));
});

function connectToNewUser(userId, stream) {
  if (connectedPeers[userId]) return;
  const call = peer.call(userId, stream);
  const video = document.createElement('video');
  call.on('stream', userStream => {
    addVideoStream(video, userStream, userId);
    connectedPeers[userId] = call;
  });
  call.on('close', () => removeVideo(userId));
}

function addVideoStream(videoEl, stream, userId) {
  if (!videoElements[userId]) {
    const container = document.createElement('div');
    container.className = 'video-container';

    const nameTag = document.createElement('div');
    nameTag.className = 'name-label';
    nameTag.innerText = userNamesMap[userId] || userId;

    container.appendChild(videoEl);
    container.appendChild(nameTag);
    videoGrid.appendChild(container);
    videoElements[userId] = container;
  }

  videoEl.srcObject = stream;
  videoEl.autoplay = true;
  videoEl.playsInline = true;
  videoEl.play().catch(err => console.warn(err));
}

function removeVideo(userId) {
  const container = videoElements[userId];
  if (container) {
    const video = container.querySelector('video');
    if (video?.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
    container.remove();
    delete videoElements[userId];
  }
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

function appendMessage(msg) {
  const li = document.createElement('div');
  li.textContent = msg;
  messagesDiv.appendChild(li);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

reactionButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const emoji = btn.dataset.reaction;
    socket.emit('reaction', {roomId:ROOM_ID, userName: my_username, reaction: emoji });
    appendMessage(`${my_username}: ${emoji}`);
  });
});

muteBtn.addEventListener('click', () => {
  audioEnabled = !audioEnabled;
  localStream.getAudioTracks()[0].enabled = audioEnabled;
  muteBtn.innerHTML = audioEnabled ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
});

videoBtn.addEventListener('click', () => {
  videoEnabled = !videoEnabled;
  localStream.getVideoTracks()[0].enabled = videoEnabled;
  videoBtn.innerHTML = videoEnabled ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
});

leaveBtn.addEventListener('click', () => {
  window.location.href = '/';
});

screenShareBtn.addEventListener('click', async () => {
  if (!screenSharing) {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      Object.values(connectedPeers).forEach(peer => {
        const sender = peer.peerConnection.getSenders().find(s => s.track.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      });
      screenTrack.onended = stopScreenShare;
      screenSharing = true;
      screenShareBtn.innerHTML = '<i class="fas fa-times"></i>';
    } catch (e) {
      console.error('Screen share error:', e);
    }
  } else {
    stopScreenShare();
  }
});
const inviteBtn = document.getElementById('invite-btn');

inviteBtn.addEventListener('click', () => {
  const inviteLink = `${window.location.origin}/room/${ROOM_ID}`;
  navigator.clipboard.writeText(inviteLink).then(() => {
    appendMessage(`📨 Invite link copied: ${inviteLink}`);
  }).catch(err => {
    console.error('Failed to copy invite link:', err);
  });
});
const endBtn = document.getElementById('end-btn');

if (endBtn) {
  endBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to end the meeting for everyone?')) {
      socket.emit('end-meeting', ROOM_ID);
    }
  });
}
document.getElementById('chat-form').addEventListener('submit', e => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (message.length > 0) {
    socket.emit('chat-message', { roomId: ROOM_ID, userName: my_username, message });
    appendMessage(`🧑‍💻 You: ${message}`);
    chatInput.value = '';
  }
});
function stopScreenShare() {
  const videoTrack = localStream.getVideoTracks()[0];
  Object.values(connectedPeers).forEach(peer => {
    const sender = peer.peerConnection.getSenders().find(s => s.track.kind === 'video');
    if (sender) sender.replaceTrack(videoTrack);
  });
  screenStream?.getTracks().forEach(track => track.stop());
  screenSharing = false;
  screenShareBtn.innerHTML = '<i class="fas fa-desktop"></i>';
}

function showJoinRequestPopup(userId, userName) {
  console.log(userName);
  const modal = document.createElement('div');
    modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div style="background: rgba(0,0,0,0.8); position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center;">
      <div style="background: white; padding: 20px; border-radius: 8px;">
        <h3>User <b>${userName}</b> wants to join.</h3>
        <div style="margin-top: 20px; text-align: right;">
          <button id="deny-btn">Deny</button>
          <button id="allow-btn">Allow</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#allow-btn').onclick = () => {
    socket.emit('approve-user', { roomId: ROOM_ID, userId, userName });
    modal.remove();
  };
  modal.querySelector('#deny-btn').onclick = () => {
    socket.emit('deny-user', { roomId: ROOM_ID, userId });
    modal.remove();
  };

  setTimeout(() => {
    if (document.body.contains(modal)) {
      socket.emit('deny-user', { roomId: ROOM_ID, userId });
      modal.remove();
    }
  }, 30000);
}
