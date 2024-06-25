import { auth, db, signIn, onDisconnect, ref, push, onChildAdded, onValue, set, get } from './firebase.js';

let peerConnections = {};
let localStream;
let isBroadcasting = false;
const configuration = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]};

function updateClock() {
  const clock = document.getElementById('clock');
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  clock.textContent = `${hours}:${minutes}:${seconds}`;
}
setInterval(updateClock, 1000);
updateClock();

document.addEventListener('DOMContentLoaded', async function() {
  const startButton = document.querySelector('.start-button');
  const menuContent = document.querySelector('.menu-content');
  const openChatBtn = document.getElementById('openChatBtn');
  const chatWindow = document.getElementById('chatWindow');
  const hideChatBtn = document.getElementById('hideChatBtn');
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const broadcastBtn = document.getElementById('broadcastBtn');
  const voiceBtn = document.getElementById('voiceBtn');
  const observer = new MutationObserver(() => {
    if (chatMessages.scrollHeight > chatMessages.clientHeight) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  });
  observer.observe(chatMessages, { childList: true });
  document.body.classList.add('loading');
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('hidden');
  await signIn();
  const currentUser = auth.currentUser;

  // Set up user presence
  const userRef = ref(db, `users/${currentUser.uid}`);
  await set(userRef, true);
  onDisconnect(userRef).remove();

  // Set up messages listener
  const messagesRef = ref(db, 'messages');
  onChildAdded(messagesRef, handleIncomingMessage);

  // Set up video chat
  await setupVideoChat();

  document.body.classList.remove('loading');
  overlay.classList.add('hidden');
  
  startButton.addEventListener('click', () => {
    const isMenuVisible = menuContent.style.display === 'block';
    menuContent.style.display = isMenuVisible ? 'none' : 'block';
  });
  document.addEventListener('click', function(event) {
    if (!startButton.contains(event.target) && !menuContent.contains(event.target)) {
      menuContent.style.display = 'none';
    }
  });
  openChatBtn.addEventListener('click', (event) => {
    event.preventDefault();
    menuContent.style.display = 'none';
    chatWindow.classList.remove('hidden');
  });
  hideChatBtn.addEventListener('click', () => {
    chatWindow.classList.add('hidden');
  });
  sendBtn.addEventListener('click', () => {
    sendChatMessage(currentUser.uid);
  });
  broadcastBtn.addEventListener('click', () => {
    toggleBroadcast(currentUser.uid);
  });
  voiceBtn.addEventListener('click', toggleVoiceChat);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendChatMessage(currentUser.uid);
    }
  });
});

async function setupVideoChat() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('_0').srcObject = localStream;
  } catch (error) {
    console.error('Error accessing media devices:', error);
  }
}

function sendChatMessage(userId) {
  const chatInput = document.getElementById('chatInput');
  const message = chatInput.value.trim();
  if (message) {
    const messagesRef = ref(db, 'messages');
    push(messagesRef, {
      userId: userId,
      text: message,
      timestamp: Date.now(),
      type: 'chat'
    });
    chatInput.value = '';
  }
}

async function toggleBroadcast(currentUserId) {
  const broadcastBtn = document.getElementById('broadcastBtn');
  
  if (isBroadcasting) {
    console.log('Stopping broadcast...');
    Object.values(peerConnections).forEach(pc => pc.close());
    peerConnections = {};
    isBroadcasting = false;
    broadcastBtn.textContent = 'Broadcast';
  } else {
    console.log('Starting broadcast...');
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    const users = snapshot.val();

    for (const userId in users) {
      if (userId !== currentUserId) {
        try {
          console.log(`Creating peer connection for user ${userId}`);
          const peerConnection = createPeerConnection(userId);
          peerConnections[userId] = peerConnection;

          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          console.log(`Sending offer to user ${userId}`);
          sendMessage(userId, { 
            type: 'offer',
            sdp: peerConnection.localDescription,
            from: currentUserId
          });
        } catch (error) {
          console.error(`Error creating offer for user ${userId}:`, error);
        }
      }
    }
    isBroadcasting = true;
    broadcastBtn.textContent = 'Stop Broadcast';
  }
}

function createPeerConnection(userId) {
  console.log(`Creating peer connection for user ${userId}`);
  const peerConnection = new RTCPeerConnection(configuration);
  
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      console.log(`Sending ICE candidate to user ${userId}`);
      sendMessage(userId, { 
        type: 'ice-candidate',
        candidate: event.candidate,
        from: auth.currentUser.uid
      });
    }
  };

  peerConnection.ontrack = event => {
    console.log(`Received track from user ${userId}`);
    const videoElement = document.querySelector(`.webcam:not([srcObject])`);
    if (videoElement) {
      videoElement.srcObject = event.streams[0];
    }
  };

  return peerConnection;
}

function sendMessage(userId, message) {
  const messagesRef = ref(db, `messages/${userId}`);
  push(messagesRef, message);
}

async function handleIncomingMessage(snapshot) {
  const message = snapshot.val();
  const currentUserId = auth.currentUser.uid;

  if (message.type === 'chat') {
    displayChatMessage(message);
  } else if (message.type === 'offer' && message.from !== currentUserId) {
    console.log(`Received offer from user ${message.from}`);
    const peerConnection = createPeerConnection(message.from);
    peerConnections[message.from] = peerConnection;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    console.log(`Sending answer to user ${message.from}`);
    sendMessage(message.from, { 
      type: 'answer',
      sdp: peerConnection.localDescription,
      from: currentUserId
    });
  } else if (message.type === 'answer' && message.from !== currentUserId) {
    console.log(`Received answer from user ${message.from}`);
    const peerConnection = peerConnections[message.from];
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp));
    }
  } else if (message.type === 'ice-candidate' && message.from !== currentUserId) {
    console.log(`Received ICE candidate from user ${message.from}`);
    const peerConnection = peerConnections[message.from];
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
    }
  }
}

function displayChatMessage(message) {
  const chatMessages = document.getElementById('chatMessages');
  const messageElement = document.createElement('div');
  messageElement.textContent = `${message.userId}: ${message.text}`;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function toggleVoiceChat() {
  if (localStream) {
    const audioTracks = localStream.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = !track.enabled;
    });
    document.getElementById('voiceBtn').textContent = audioTracks[0].enabled ? 'Mute' : 'Unmute';
  }
}