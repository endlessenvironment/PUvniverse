import { signIn } from './firebase.js';
import { getDatabase, ref, push, onChildAdded, onChildRemoved, onDisconnect, set, remove } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js";

const database = getDatabase();
const connectionsRef = ref(database, 'connections');
const offersRef = ref(database, 'offers');
const answersRef = ref(database, 'answers');
const candidatesRef = ref(database, 'candidates');
const messagesRef = ref(database, 'messages');

let userId;
const peerConnections = {};
let localStream = null;

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

async function createConnection(connectionUserId) {
  console.log(`Creating connection with user ${connectionUserId}`);
    const peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      // Add TURN server configuration here if you have one
      // { urls: 'turn:your-turn-server.com:3478', username: 'username', credential: 'password' },
    ]
  });
  peerConnections[connectionUserId] = peerConnection;

  // We'll add the stream later if it's available

  // Add event listeners for remote stream
peerConnection.ontrack = (event) => {
  console.log('Received remote stream');
  const remoteStream = event.streams[0];
  let videoElement = document.querySelector(`.webcam[data-user-id="${connectionUserId}"]`);
  if (!videoElement) {
    videoElement = getAvailableWebcamSpot();
    if (videoElement) {
      videoElement.setAttribute('data-user-id', connectionUserId);
    }
  }
  if (videoElement) {
    videoElement.srcObject = remoteStream;
  }
};

  // Add event listener for ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('Sending ICE candidate');
      push(candidatesRef, { from: userId, to: connectionUserId, candidate: event.candidate.toJSON() });
    }
  };

  // Add event listener for negotiation needed
  peerConnection.onnegotiationneeded = async () => {
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      console.log('Sending offer');
      push(offersRef, { from: userId, to: connectionUserId, offer });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  return peerConnection;
}

async function handleOffer(snapshot) {
  const data = snapshot.val();
  if (data.to === userId) {
    console.log('Received offer');
    const peerConnection = peerConnections[data.from] || await createConnection(data.from);

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log('Sending answer');
      push(answersRef, { from: userId, to: data.from, answer });

      // Delete the offer after sending the answer
      remove(snapshot.ref);
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }
}

async function handleAnswer(snapshot) {
  const data = snapshot.val();
  if (data.to === userId) {
    console.log('Received answer');
    const peerConnection = peerConnections[data.from];
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));

        // Delete the answer after setting the remote description
        remove(snapshot.ref);
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    }
  }
}

async function handleCandidate(snapshot) {
  const data = snapshot.val();
  if (data.to === userId) {
    console.log('Received ICE candidate');
    const peerConnection = peerConnections[data.from];
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));

        // Delete the candidate after adding it to the peer connection
        remove(snapshot.ref);
      } catch (error) {
        console.error('Error handling ICE candidate:', error);
      }
    }
  }
}
function sendMessage(message) {
  console.log('Sending message:', message);
  push(messagesRef, { from: userId, message });
}

function handleMessage(snapshot) {
  const data = snapshot.val();
  console.log('Received message:', data.message);
  const messageElement = document.createElement('div');
  messageElement.textContent = `${data.from}: ${data.message}`;
  chatMessages.appendChild(messageElement);
}

function addUserToList(connectionUserId) {
  console.log('Adding user to list:', connectionUserId);
  const listItem = document.createElement('div');
  listItem.textContent = connectionUserId;
  listItem.classList.add('List-item');
  listItem.setAttribute('data-user-id', connectionUserId);
  ListContainer.appendChild(listItem);
}

function removeUserFromList(connectionUserId) {
  console.log('Removing user from list:', connectionUserId);
  const listItem = ListContainer.querySelector(`[data-user-id="${connectionUserId}"]`);
  if (listItem) {
    ListContainer.removeChild(listItem);
  }
}

function getAvailableWebcamSpot() {
  const webcamSpots = document.querySelectorAll('.webcam');
  for (let i = 1; i < webcamSpots.length; i++) {
    if (!webcamSpots[i].srcObject) {
      return webcamSpots[i];
    }
  }
  return null;
}

function resetWebcamSpot(connectionUserId) {
  console.log('Resetting webcam spot for user:', connectionUserId);
  const webcamSpots = document.querySelectorAll('.webcam');
  for (const spot of webcamSpots) {
    if (spot.getAttribute('data-user-id') === connectionUserId) {
      spot.srcObject = null;
      spot.removeAttribute('data-user-id');
      break;
    }
  }
}

async function startBroadcast() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    console.log('Local stream started');
    const localWebcamSpot = document.querySelector('.webcam');
    localWebcamSpot.srcObject = localStream;
    localWebcamSpot.muted = true;

    // Add local stream to existing connections
    Object.keys(peerConnections).forEach(connectionUserId => {
      const peerConnection = peerConnections[connectionUserId];
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    });

  } catch (error) {
    console.error('Error accessing media devices:', error);
  }
}

function stopBroadcast() {
  if (localStream) {
    console.log('Stopping local stream');
    localStream.getTracks().forEach((track) => {
      track.stop();
    });
    localStream = null;
  }
  const localWebcamSpot = document.querySelector('.webcam');
  localWebcamSpot.srcObject = null;
}

document.addEventListener('DOMContentLoaded', async function() {
  const desktop = document.getElementById('desktop');	
  const startButton = document.getElementById('startBtn');
  const menuContent = document.getElementById('menuCntnt');
  const openChatBtn = document.getElementById('openChatBtn');
  const openListBtn = document.getElementById('openListBtn');
  const chatWindow = document.getElementById('chatWindow');
  const ListWindow = document.getElementById('ListWindow');
  const hideChatBtn = document.getElementById('hideChatBtn');
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const broadcastBtn = document.getElementById('broadcastBtn');
  const voiceBtn = document.getElementById('voiceBtn');
  const hideListBtn = document.getElementById('hideListBtn');
  const ListContainer = document.getElementById('ListContainer');

  const observer = new MutationObserver(() => {
    if (chatMessages.scrollHeight > chatMessages.clientHeight) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  });
  observer.observe(chatMessages, { childList: true });

  document.body.classList.add('loading');
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('hidden');

  userId = await signIn();
  console.log('Signed in with user ID:', userId);

  document.body.classList.remove('loading');
  overlay.classList.add('hidden');

  const nicknameInput = document.getElementById('ListNickname');
  nicknameInput.value = userId;

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
    menuContent.style.display = 'none';
    showWindow(chatWindow, ListWindow);
  });

  openListBtn.addEventListener('click', (event) => {
    menuContent.style.display = 'none';
    showWindow(ListWindow, chatWindow);
  });

  hideChatBtn.addEventListener('click', () => {
    chatWindow.classList.add('hidden');
  });

  hideListBtn.addEventListener('click', () => {
    ListWindow.classList.add('hidden');
  });
  
    sendBtn.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message !== '') {
      sendMessage(message);
      chatInput.value = '';
    }
  });

  broadcastBtn.addEventListener('click', () => {
    if (!localStream) {
      startBroadcast();
      broadcastBtn.textContent = 'Stop Broadcast';
    } else {
      stopBroadcast();
      broadcastBtn.textContent = 'Start Broadcast';
    }
  });
  
  
  function checkWindowFit() {
    const desktopRect = desktop.getBoundingClientRect();
    const chatRect = chatWindow.getBoundingClientRect();
    const ListRect = ListWindow.getBoundingClientRect();
    if (chatRect.right > desktopRect.right || chatRect.bottom > desktopRect.bottom) {
      chatWindow.classList.add('hidden');
      console.log('Chat window does not fit in the desktop and has been minimized');
	  alert("Chat does not fit in the desktop and has been minimized");
    }
    if (ListRect.right > desktopRect.right || ListRect.bottom > desktopRect.bottom) {
      ListWindow.classList.add('hidden');
      console.log('List window does not fit in the desktop and has been minimized');
	  alert("List does not fit in the desktop and has been minimized");
    }
  }
  function showWindow(windowToShow, windowToHide) {
    windowToShow.classList.remove('hidden');
    windowToHide.classList.add('hidden');
    checkWindowFit();
  }  
  window.addEventListener('resize', checkWindowFit);
  checkWindowFit();

  const userRef = ref(database, `connections/${userId}`);
  onDisconnect(userRef).remove();
  set(userRef, true);
  
onChildAdded(connectionsRef, async (snapshot) => {
  const connectionUserId = snapshot.key;
  console.log('New user connected:', connectionUserId);
  if (connectionUserId !== userId) {
    const peerConnection = await createConnection(connectionUserId);
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }
    addUserToList(connectionUserId);
  }
});

  onChildRemoved(connectionsRef, (snapshot) => {
    const connectionUserId = snapshot.key;
    console.log('User disconnected:', connectionUserId);
    removeUserFromList(connectionUserId);
    resetWebcamSpot(connectionUserId);
    const peerConnection = peerConnections[connectionUserId];
    if (peerConnection) {
      peerConnection.close();
      delete peerConnections[connectionUserId];
    }
  });

  onChildAdded(offersRef, handleOffer);
  onChildAdded(answersRef, handleAnswer);
  onChildAdded(candidatesRef, handleCandidate);
  onChildAdded(messagesRef, handleMessage);

  voiceBtn.addEventListener('click', () => {
    // Enable voice communication
    // ...
  });
});