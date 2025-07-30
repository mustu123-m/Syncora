const userNamesMap = {};
const connectedPeers = {}; // Stores PeerJS Call objects
const connectedUsers = {}; // Stores <li> elements for user list
const videoElements = {}; // Stores video container <div> elements by userId
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

const peer = new Peer(undefined, {
    host: window.location.hostname,
    path: '/peerjs', // Changed to match server
    secure: window.location.protocol === 'https:',
    port: window.location.protocol === 'https:' ? 443 : 80
});

// Add error handling for PeerJS
peer.on('error', (err) => {
    console.error('PeerJS error:', err);
    if (err.type === 'unavailable-id') {
        console.log('Peer ID was taken, retrying...');
        // Consider a more robust reconnect logic if this becomes an issue
        // For now, `reconnect` might be sufficient, but could lead to loop
        // peer.reconnect();
    } else if (err.type === 'peer-unavailable') {
        console.warn(`Peer unavailable: ${err.message}. They might have disconnected.`);
        // No need to explicitly remove video here, as socket 'user-disconnected' or 'close' should handle it.
    }
});

const myVideo = document.createElement('video');
myVideo.muted = true; // Still mute your own video to avoid echo

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        localStream = stream;
        originalVideoTrack = stream.getVideoTracks()[0];
        originalAudioTrack = stream.getAudioTracks()[0];
        // Only add self video if host or immediately if not requiring approval
        // Otherwise, add it on user-approved event
        if (isHost || !requireApproval) { // Added !requireApproval condition here
            addVideoStream(myVideo, stream, peer.id);
        }
    })
    .catch(err => {
        alert("🎥 Could not access camera/microphone. Check permissions. You might not be able to join the call without them.");
        console.error("Error accessing media devices:", err);
    });

const socket = io(window.location.origin, {
    path: '/socket.io',
    transports: ['websocket', 'polling'] // Ensure websocket and polling are enabled for broader compatibility
});

peer.on('open', id => {
    userNamesMap[id] = my_username;

    if (isHost) {
        document.getElementById('meeting-ui').style.display = 'block';
        console.log("Emitting host-ready", ROOM_ID, peer.id, my_username);
        socket.emit('host-ready', ROOM_ID, id, my_username);
    } else {
        document.getElementById('waiting-room').style.display = 'block';
        console.log("Requesting to join as guest:", my_username);
        socket.emit('request-join', ROOM_ID, id, my_username, isHost, requireApproval);
    }

    socket.on('user-approved', ({ approved, isHost: hostStatus }) => {
        if (!approved) {
            alert("❌ Access denied by host.");
            return window.location.href = '/dashboard';
        }
        isHost = hostStatus; // Update isHost status in case it changed
        // Ensure local stream is available before adding video
        if (localStream) {
            addVideoStream(myVideo, localStream, peer.id); // Add your own video stream once approved
        } else {
            console.warn("Local stream not available when approved. There might be a media permission issue.");
            // Consider re-attempting getUserMedia here or displaying a warning
        }
        document.getElementById('meeting-ui').style.display = 'block';
        document.getElementById('waiting-room').style.display = 'none';
        
        // Emit join-room AFTER UI is ready and stream added, and ensure server uses it
        socket.emit('join-room', ROOM_ID, peer.id, my_username);
    });

    socket.on('join-request', ({ userId, userName }) => {
            showJoinRequestPopup(userId, userName);
    });

    // This event should only send *other* existing users, not the joining user themselves
    socket.on('existing-users', users => {
        users.forEach(({ userId, userName }) => {
            if (userId !== peer.id) { // Ensure we don't try to connect to ourselves
                addUserToList(userId, userName);
                // Delay connection slightly to allow UI rendering and avoid race conditions
                setTimeout(() => {
                    if (localStream) { // Only connect if local stream is available
                        connectToNewUser(userId, localStream);
                    } else {
                        console.warn(`Local stream not available to connect to ${userName}.`);
                    }
                }, 500);
            }
        });
    });

    socket.on('user-connected', ({ userId, userName }) => {
        console.log(`User connected: ${userName} (${userId})`);
        if (userId !== peer.id) { // Don't try to connect to ourselves
            addUserToList(userId, userName);
            // Delay connection slightly to allow UI rendering and avoid race conditions
            setTimeout(() => {
                if (localStream) { // Only connect if local stream is available
                    connectToNewUser(userId, localStream);
                } else {
                    console.warn(`Local stream not available to connect to ${userName}.`);
                }
            }, 500);
        }
    });

    socket.on('user-disconnected', userId => {
        console.log(`User disconnected: ${userId}`);
        // Ensure all associated PeerJS calls are closed and resources are released
        if (connectedPeers[userId]) {
            connectedPeers[userId].close(); // Explicitly close the PeerJS call
            delete connectedPeers[userId]; // Remove from map
        }
        removeUserFromList(userId); // Remove from UI user list
        removeVideo(userId); // Remove their video element
    });

    socket.on('meeting-ended', () => {
        alert("🚫 The host has ended the meeting.");
        // Clean up local streams and PeerJS connections before redirecting
        localStream?.getTracks().forEach(track => track.stop());
        screenStream?.getTracks().forEach(track => track.stop());
        peer.destroy(); // Disconnect from PeerJS server
        window.location.href = '/dashboard';
    });

    socket.on('chat-message', ({ userName, message }) => {
        appendMessage(`💬 ${userName}: ${message}`);
    });

    socket.on('reaction', ({ userName, reaction }) => { // Removed ROOM_ID as it's not used here
        appendMessage(`🎉 ${userName} reacted with ${reaction}`);
    });

    socket.on('join-denied', ({ message }) => {
        console.log("You are denied entry.");
        alert(message || 'Your request to join the meeting was denied by the host.');
        // Clean up resources before redirecting
        localStream?.getTracks().forEach(track => track.stop());
        peer.destroy();
        window.location.href = '/dashboard';
    });
});

peer.on('call', call => {
    // Check if localStream is available before answering
    if (localStream) {
        call.answer(localStream);
    } else {
        console.warn(`Local stream not available to answer call from ${call.peer}.`);
        call.close(); // Close the call if we can't provide a stream
        return;
    }

    const video = document.createElement('video');
    call.on('stream', stream => {
        addVideoStream(video, stream, call.peer);
        connectedPeers[call.peer] = call; // Store the call object
    });
    call.on('close', () => {
        console.log(`Call from ${call.peer} closed.`);
        // This is handled by socket.on('user-disconnected') primarily
        // but it's good to have this as a fallback.
        // Ensure that connectedPeers[call.peer] is explicitly deleted only once
        if (connectedPeers[call.peer]) {
            connectedPeers[call.peer].close(); // Ensure it's fully closed
            delete connectedPeers[call.peer];
        }
        removeVideo(call.peer);
        removeUserFromList(call.peer); // Also remove from user list here
    });
    // Add error handling for the call itself
    call.on('error', (err) => {
        console.error(`Error on call with ${call.peer}:`, err);
        // Clean up if a call error occurs
        if (connectedPeers[call.peer]) {
            connectedPeers[call.peer].close();
            delete connectedPeers[call.peer];
        }
        removeVideo(call.peer);
        removeUserFromList(call.peer);
    });
});

function connectToNewUser(userId, stream) {
    // Prevent connecting to self or already connected peers
    if (userId === peer.id || connectedPeers[userId]) {
        console.log(`Skipping connection to ${userId}: either self or already connected.`);
        return;
    }

    console.log(`Attempting to connect to new user: ${userId}`);
    const call = peer.call(userId, stream);
    const video = document.createElement('video');
    call.on('stream', userStream => {
        console.log(`Stream received from ${userId}`);
        addVideoStream(video, userStream, userId);
        connectedPeers[userId] = call; // Store the call object
    });
    call.on('close', () => {
        console.log(`Call to ${userId} closed.`);
        // Same as above, ensure proper cleanup
        if (connectedPeers[userId]) {
            connectedPeers[userId].close();
            delete connectedPeers[userId];
        }
        removeVideo(userId);
        removeUserFromList(userId);
    });
    call.on('error', (err) => {
        console.error(`Error on call to ${userId}:`, err);
        // Clean up if a call error occurs
        if (connectedPeers[userId]) {
            connectedPeers[userId].close();
            delete connectedPeers[userId];
        }
        removeVideo(userId);
        removeUserFromList(userId);
    });
}

function addVideoStream(videoEl, stream, userId) {
    // Only add if not already present to prevent duplicates
    if (!videoElements[userId]) {
        const container = document.createElement('div');
        container.className = 'video-container';
        container.dataset.userId = userId; // Add a data attribute for easier lookup

        const nameTag = document.createElement('div');
        nameTag.className = 'name-label';
        nameTag.innerText = userNamesMap[userId] || 'Guest'; // Fallback name

        container.appendChild(videoEl);
        container.appendChild(nameTag);
        videoGrid.appendChild(container);
        videoElements[userId] = container;
        console.log(`Video stream added for: ${userNamesMap[userId] || userId}`);
    }

    videoEl.srcObject = stream;
    videoEl.autoplay = true;
    videoEl.playsInline = true;
    videoEl.play().catch(err => console.warn(`Error playing video for ${userId}:`, err));
}

function removeVideo(userId) {
    const container = videoElements[userId];
    if (container) {
        console.log(`Removing video for: ${userId}`);
        const video = container.querySelector('video');
        if (video && video.srcObject) {
            // Stop all tracks to release camera/mic resources
            video.srcObject.getTracks().forEach(track => track.stop());
            video.srcObject = null; // Dereference the stream
        }
        container.remove(); // Remove the DOM element
        delete videoElements[userId]; // Remove from map
    } else {
        console.warn(`Attempted to remove video for ${userId}, but container not found.`);
    }
}

function addUserToList(userId, name) {
    if (connectedUsers[userId]) return; // Prevent duplicates
    userNamesMap[userId] = name; // Ensure name is stored
    const li = document.createElement('li');
    li.id = `user-${userId}`;
    li.innerText = `👤 ${name}`;
    userList.appendChild(li);
    connectedUsers[userId] = li;
    console.log(`User added to list: ${name} (${userId})`);
}

function removeUserFromList(userId) {
    if (connectedUsers[userId]) {
        connectedUsers[userId].remove();
        delete connectedUsers[userId];
        delete userNamesMap[userId]; // Also remove name from map
        console.log(`User removed from list: ${userId}`);
    } else {
        console.warn(`Attempted to remove user ${userId} from list, but not found.`);
    }
}

function appendMessage(msg) {
    const li = document.createElement('div');
    li.className = 'chat-message'; // Add class for styling
    li.textContent = msg;
    messagesDiv.appendChild(li);
    messagesDiv.scrollTop = messagesDiv.scrollHeight; // Auto-scroll to latest message
}

reactionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const emoji = btn.dataset.reaction;
        socket.emit('reaction', { roomId: ROOM_ID, userName: my_username, reaction: emoji });
        appendMessage(`🧑‍💻 You reacted with ${emoji}`); // Indicate it's your own reaction
    });
});

muteBtn.addEventListener('click', () => {
    if (!localStream) {
        console.warn("No local stream available to mute/unmute.");
        return;
    }
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioEnabled = !audioTrack.enabled; // Toggle based on current state
        audioTrack.enabled = audioEnabled;
        muteBtn.innerHTML = audioEnabled ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
        appendMessage(`🧑‍💻 You ${audioEnabled ? 'unmuted' : 'muted'} your microphone.`);
    } else {
        console.warn("No audio track found in local stream.");
    }
});

videoBtn.addEventListener('click', () => {
    if (!localStream) {
        console.warn("No local stream available to toggle video.");
        return;
    }
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoEnabled = !videoTrack.enabled; // Toggle based on current state
        videoTrack.enabled = videoEnabled;
        videoBtn.innerHTML = videoEnabled ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
        appendMessage(`🧑‍💻 You ${videoEnabled ? 'enabled' : 'disabled'} your video.`);
    } else {
        console.warn("No video track found in local stream.");
    }
});

leaveBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to leave the meeting?')) {
        // Stop local media tracks
        localStream?.getTracks().forEach(track => track.stop());
        screenStream?.getTracks().forEach(track => track.stop());

        // Close all PeerJS connections
        Object.values(connectedPeers).forEach(call => {
            if (call && call.open) {
                call.close();
            }
        });
        peer.destroy(); // Disconnect from PeerJS server

        // Notify server that user is leaving (though 'disconnecting' handles it too)
        socket.emit('leave-room', ROOM_ID, peer.id); // You might want to add this custom event if not using disconnect
        window.location.href = '/dashboard';
    }
});

screenShareBtn.addEventListener('click', async () => {
    if (!screenSharing) {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];

            // Update local video element to show screen share
            if (myVideo) {
                myVideo.srcObject = screenStream;
                myVideo.muted = true;
                myVideo.play().catch(err => console.warn("Error playing screen share video locally:", err));
            }

            // Replace track for remote peers
            Object.values(connectedPeers).forEach(call => {
                const sender = call.peerConnection.getSenders().find(s => s.track.kind === 'video');
                if (sender) {
                    sender.replaceTrack(screenTrack).catch(e => console.error("Error replacing video track for peer:", e));
                }
            });

            screenTrack.onended = stopScreenShare; // Listen for screen share stop event
            screenSharing = true;
            screenShareBtn.innerHTML = '<i class="fas fa-times"></i> Stop Sharing';
            appendMessage(`🧑‍💻 You started screen sharing.`);
        } catch (e) {
            console.error('Screen share error:', e);
            alert("Could not start screen sharing. Please check permissions or try again. (Common reasons: user denied, or no screen selected)");
        }
    } else {
        stopScreenShare();
        appendMessage(`🧑‍💻 You stopped screen sharing.`);
    }
});

const inviteBtn = document.getElementById('invite-btn');

inviteBtn.addEventListener('click', () => {
    const inviteLink = `${window.location.origin}/room/${ROOM_ID}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
        appendMessage(`📨 Invite link copied: ${inviteLink}`);
    }).catch(err => {
        console.error('Failed to copy invite link:', err);
        alert("Failed to copy invite link. Please copy it manually from the URL bar.");
    });
});

const endBtn = document.getElementById('end-btn');

if (endBtn) { // This button only exists if isHost is true
    endBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to end the meeting for everyone? This action cannot be undone.')) {
            socket.emit('end-meeting', ROOM_ID);
        }
    });
}

document.getElementById('chat-form').addEventListener('submit', e => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (message.length > 0) {
        socket.emit('chat-message', { roomId: ROOM_ID, userName: my_username, message });
        appendMessage(`🧑‍💻 You: ${message}`); // Display your own message immediately
        chatInput.value = '';
    }
});

function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }

    // Revert local video element to webcam stream IF it's enabled
    if (myVideo && localStream && localStream.getVideoTracks().length > 0) {
        myVideo.srcObject = localStream;
        myVideo.muted = true;
        myVideo.play().catch(err => console.warn("Error playing webcam video locally after screen share stop:", err));
    } else {
        // If webcam was disabled, the video element might show black. This is expected.
        myVideo.srcObject = null; // Clear if no local stream or video disabled
    }

    // Replace track for remote peers back to webcam
    Object.values(connectedPeers).forEach(call => {
        const sender = call.peerConnection.getSenders().find(s => s.track.kind === 'video');
        if (sender && localStream && localStream.getVideoTracks().length > 0) {
            const videoTrack = localStream.getVideoTracks()[0];
            sender.replaceTrack(videoTrack).catch(e => console.error("Error replacing video track for peer after screen share stop:", e));
        } else if (sender) {
            // If local video is disabled or not available, send a black frame or just remove the track
            // Sending null or removing track might terminate the stream for the other side if not handled well
            // A common approach is to send a dummy black video track if video is 'disabled'
            // For now, let's just stop the sender if no local stream is available to replace with
             sender.replaceTrack(null).catch(e => console.error("Error setting video track to null after screen share stop:", e));
        }
    });

    screenSharing = false;
    screenShareBtn.innerHTML = '<i class="fas fa-desktop"></i> Share Screen';
}

function showJoinRequestPopup(userId, userName) {
    console.log(`Showing join request for: ${userName} (${userId})`);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div style="
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          font-family: 'Segoe UI', sans-serif;
        ">
          <div style="
            background: #2c2f33;
            color: #ffffff;
            padding: 30px 25px;
            border-radius: 10px;
            width: 90%;
            max-width: 400px;
            box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
            text-align: center;
          ">
            <h2 style="margin-top: 0; margin-bottom: 15px; font-size: 20px;">Join Request</h2>
            <p style="margin-bottom: 25px; font-size: 16px;">
              <strong>${userName}</strong> is requesting to join the meeting.
            </p>
            <div style="display: flex; justify-content: center; gap: 15px;">
              <button id="deny-btn" style="
                padding: 10px 18px;
                background: #ff4d4f;
                border: none;
                border-radius: 6px;
                color: white;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.3s ease;
              ">
                Deny
              </button>
              <button id="allow-btn" style="
                padding: 10px 18px;
                background: #4caf50;
                border: none;
                border-radius: 6px;
                color: white;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.3s ease;
              ">
                Allow
              </button>
            </div>
          </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Use a unique ID for the popup to prevent multiple popups for the same user
    // if a host clicks multiple times or if request-join is somehow re-emitted.
    modal.dataset.userId = userId;

    const denyButton = modal.querySelector('#deny-btn');
    const allowButton = modal.querySelector('#allow-btn');

    const handleAction = (action) => {
        if (action === 'allow') {
            socket.emit('approve-user', { roomId: ROOM_ID, userId, userName });
        } else { // 'deny'
            socket.emit('deny-user', { roomId: ROOM_ID, userId });
        }
        modal.remove(); // Remove popup after action
        // Clean up event listeners to prevent memory leaks
        denyButton.removeEventListener('click', denyHandler);
        allowButton.removeEventListener('click', allowHandler);
        clearTimeout(timeoutId);
    };

    const denyHandler = () => handleAction('deny');
    const allowHandler = () => handleAction('allow');

    denyButton.addEventListener('click', denyHandler);
    allowButton.addEventListener('click', allowHandler);

    // Auto-deny if not acted upon within 30 seconds
    const timeoutId = setTimeout(() => {
        if (document.body.contains(modal)) { // Check if modal is still in DOM
            console.log(`Join request for ${userName} timed out. Denying.`);
            handleAction('deny'); // Automatically deny
        }
    }, 30000); // 30 seconds
}
