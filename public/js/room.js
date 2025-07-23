

const userNamesMap = {};
const connectedPeers = {};
const connectedUsers = {};
const videoElements = {};

let socket;
let localStream, originalVideoTrack, originalAudioTrack;
let screenSharing = false;

// const peer = new Peer(undefined, {
//   host: 'localhost',
//   port: 9000,
//   path: '/',
//   secure: window.location.protocol === 'https:'
// });
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
  // Immediate host handling
  if (isHost) {
    document.getElementById('meeting-ui').style.display = 'block';
    document.getElementById('waiting-room').style.display = 'none';
      socket.emit('host-ready', ROOM_ID, peer.id, my_username); // Changed from 'join-room'
  } else {
    document.getElementById('meeting-ui').style.display = 'none';
    document.getElementById('waiting-room').style.display = 'block';
    socket.emit('request-join', ROOM_ID, peer.id, my_username, isHost, requireApproval);
  }
  socket.on('join-request', ({ userId, userName }) => {
    if(isHost){
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

       if(localStream)
       {
        addVideoStream(myVideo, localStream, peer.id);
       }
       else {
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

    // Host sees own video immediately
    if (isHost) {
      console.log("You are the host. Showing your video immediately.");
      addVideoStream(myVideo, stream, peer.id);
    }
  })
  .catch(err => {
    console.error("Failed to access webcam/mic", err);
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
  console.log("Stream state:", stream.active ? "active" : "inactive");
  console.log("Video tracks:", stream.getVideoTracks());
  console.log("Audio tracks:", stream.getAudioTracks());
  let container = videoElements[userId];
  
  if (!container) {
    container = document.createElement('div');
    container.className = 'video-container';
    videoElements[userId] = container;
    
    // Create new video element if none exists
    if (!videoEl) {
      videoEl = document.createElement('video');
      videoEl.muted = (userId === peer.id); // Mute only our own video
    }
    
    const nameTag = document.createElement('div');
    nameTag.className = 'name-label';
    nameTag.innerText = userNamesMap[userId] || userId;
    
    container.appendChild(videoEl);
    container.appendChild(nameTag);
    videoGrid.appendChild(container);
  }

  // Always update the video source
  videoEl.srcObject = stream;
  
  // Handle the case where metadata is already loaded
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

  if (count <= 1) {
    grid.style.gridTemplateColumns = '1fr';
  } else if (count === 2) {
    grid.style.gridTemplateColumns = '1fr 1fr';
  } else if (count <= 4) {
    grid.style.gridTemplateColumns = '1fr 1fr';
  } else if (count <= 6) {
    grid.style.gridTemplateColumns = '1fr 1fr 1fr';
  } else if (count <= 9) {
    grid.style.gridTemplateColumns = '1fr 1fr 1fr';
  } else {
    grid.style.gridTemplateColumns = '1fr 1fr 1fr 1fr';
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

function showJoinRequestPopup(userId, userName) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML =
    `<div class="bg-white p-6 rounded shadow-lg text-center">
      <p class="text-lg font-semibold mb-4">👤 ${userName} wants to join</p>
      <button id="allow-btn" class="bg-blue-500 text-white px-4 py-2 rounded mr-2">Allow</button>
      <button id="deny-btn" class="bg-gray-400 text-white px-4 py-2 rounded">Deny</button>
    </div>`;
  document.body.appendChild(modal);

  document.getElementById('allow-btn').onclick = () => {
    socket.emit('approve-user', { roomId: ROOM_ID, userId, userName });
    modal.remove();
  };
  document.getElementById('deny-btn').onclick = () => modal.remove();
}

const muteBtn = document.getElementById('mute-btn');
muteBtn.addEventListener('click', () => {
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  muteBtn.innerHTML = audioTrack.enabled
    ? '<i class="fas fa-microphone"></i>'
    : '<i class="fas fa-microphone-slash"></i>';
});

const videoBtn = document.getElementById('video-btn');
videoBtn.addEventListener('click', () => {
  const videoTrack = localStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
  videoBtn.innerHTML = videoTrack.enabled
    ? '<i class="fas fa-video"></i>'
    : '<i class="fas fa-video-slash"></i>';
});

shareBtn.addEventListener('click', async () => {
  if (!screenSharing) {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      for (let userId in connectedPeers) {
        const sender = connectedPeers[userId].peerConnection.getSenders().find(s => s.track.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      }

      screenTrack.onended = () => stopScreenShare();

      const newStream = new MediaStream([screenTrack, originalAudioTrack]);
      addVideoStream(myVideo, newStream, peer.id);
      localStream = newStream;
      screenSharing = true;
      shareBtn.innerHTML = '<i class="fas fa-desktop"></i>';
    } catch (err) {
      console.error('Screen share failed', err);
    }
  } else {
    stopScreenShare();
  }
});

function stopScreenShare() {
  const newStream = new MediaStream([originalVideoTrack, originalAudioTrack]);

  for (let userId in connectedPeers) {
    const sender = connectedPeers[userId].peerConnection.getSenders().find(s => s.track.kind === 'video');
    if (sender) sender.replaceTrack(originalVideoTrack);
  }

  addVideoStream(myVideo, newStream, peer.id);
  localStream = newStream;
  screenSharing = false;
  shareBtn.innerHTML = '<i class="fas fa-desktop"></i>';
}

document.getElementById('chat-form').addEventListener('submit', e => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;
  socket.emit('chat-message', { roomId: ROOM_ID, userId: peer.id, userName: my_username, message });
  appendMessage(`🟢 You: ${message}`);
  chatInput.value = '';
});

function appendMessage(msg) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message';
  msgDiv.textContent = msg;
  messagesDiv.appendChild(msgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

document.querySelectorAll('.reaction-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const reaction = btn.dataset.reaction;
    socket.emit('reaction', { roomId: ROOM_ID, userId: peer.id, userName: my_username, reaction });
    appendMessage(`📣 You sent a reaction: ${reaction}`);
  });
});

document.getElementById('leave-btn').addEventListener('click', () => {
  if (confirm("Leave the meeting?")) {
    socket.disconnect();
    window.location.href = '/dashboard';
  }
});

const endBtn = document.getElementById('end-btn');
if (endBtn) {
  endBtn.addEventListener('click', () => {
    if (confirm("End the meeting for everyone?")) {
      socket.disconnect();
      window.location.href = '/dashboard';
    }
  });
}

document.getElementById('invite-btn').addEventListener('click', () => {
  const url = `${window.location.origin}/room/${ROOM_ID}`;
  navigator.clipboard.writeText(url)
    .then(() => alert("🔗 Link copied to clipboard!"))
    .catch(() => alert("❌ Failed to copy."));
});
