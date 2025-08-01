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

peer.reconnect();

}

});



const myVideo = document.createElement('video');

myVideo.muted = true; // Still mute your own video to avoid echo



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

// transports: ['websocket'] // This line is commented out, which is fine, as 'websocket' is default

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

addVideoStream(myVideo, localStream, peer.id); // Add your own video stream once approved

document.getElementById('meeting-ui').style.display = 'block';

document.getElementById('waiting-room').style.display = 'none';

socket.emit('join-room', ROOM_ID, peer.id, my_username); // This join-room event doesn't seem to be handled on the server.js side for anything specific after approval, but it's here.

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



socket.on('reaction', ({ ROOM_ID, userName, reaction }) => {

appendMessage(`🎉 ${userName} reacted with ${reaction}`);

});

socket.on('join-denied', ({ message }) => {

console.log("You are denied");

alert(message || 'You were denied entry by the host.');

window.location.href = '/dashboard'; // or show a proper message/page

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
        console.log(`Removing video for: ${userNamesMap[userId] || userId}`); // More descriptive log
        const video = container.querySelector('video');
        if (video?.srcObject) {
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

if (connectedUsers[userId]) return;

userNamesMap[userId] = name;

const li = document.createElement('li');

li.id = `user-${userId}`;

li.innerText = `👤 ${name}`;

userList.appendChild(li);

connectedUsers[userId] = li;

}



function removeUserFromList(userId) {
    if (connectedUsers[userId]) {
        connectedUsers[userId].remove();
        delete connectedUsers[userId];
        delete userNamesMap[userId]; // <-- ADD THIS LINE to clean userNamesMap
        console.log(`User removed from list: ${userId}`);
    } else {
        console.warn(`Attempted to remove user ${userId} from list, but not found.`);
    }
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

socket.emit('reaction', { roomId: ROOM_ID, userName: my_username, reaction: emoji });

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



// Update local video element to show screen share

myVideo.srcObject = screenStream;

myVideo.muted = true; // Still mute your own video

myVideo.play().catch(err => console.warn(err));



// Replace track for remote peers

Object.values(connectedPeers).forEach(peer => {

const sender = peer.peerConnection.getSenders().find(s => s.track.kind === 'video');

if (sender) sender.replaceTrack(screenTrack);

});



screenTrack.onended = stopScreenShare; // Listen for screen share stop event

screenSharing = true;

screenShareBtn.innerHTML = '<i class="fas fa-times"></i> Stop Sharing'; // Update button text

} catch (e) {

console.error('Screen share error:', e);

alert("Could not start screen sharing. Please check permissions or try again.");

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

// Stop the screen share tracks

screenStream?.getTracks().forEach(track => track.stop());

screenStream = null; // Clear the screen stream



// Revert local video element to webcam stream

myVideo.srcObject = localStream;

myVideo.muted = true;

myVideo.play().catch(err => console.warn(err));



// Replace track for remote peers back to webcam

const videoTrack = localStream.getVideoTracks()[0]; // Get the original webcam track

Object.values(connectedPeers).forEach(peer => {

const sender = peer.peerConnection.getSenders().find(s => s.track.kind === 'video');

if (sender && videoTrack) { // Ensure videoTrack exists before replacing

sender.replaceTrack(videoTrack);

}

});



screenSharing = false;

screenShareBtn.innerHTML = '<i class="fas fa-desktop"></i> Share Screen'; // Update button text

}



function showJoinRequestPopup(userId, userName) {

console.log(userName);

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



modal.querySelector('#allow-btn').onclick = () => {

socket.emit('approve-user', { roomId: ROOM_ID, userId, userName });

modal.remove();

};

modal.querySelector('#deny-btn').onclick = () => {

console.log("deny clicked");

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
