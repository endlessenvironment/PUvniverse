import { signIn, getDatabase } from './firebase.js';
import { ref, push, onChildAdded, onChildRemoved, onDisconnect, set, remove, onValue, get } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js";
import { initWebRTC, createConnection, handleOffer, handleAnswer, handleCandidate, resetWebcamSpot, startBroadcast, stopBroadcast, closePeerConnection } from './webrtc.js';
import { initializeNickname, setupNicknameListener, getNickname, setNickname, deleteNickname } from './usersettings.js';

const database = getDatabase();
const connectionsRef = ref(database, 'connections');
const messagesRef = ref(database, 'messages');
const nicknamesRef = ref(database, 'nicknames');

let userId;
let userNickname;

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

async function sendMessage(message) {
  const nickname = await getNickname(userId) || userId;
  console.log('Sending message:', message);
  push(messagesRef, { from: nickname, message });
}

async function handleMessage(snapshot) {
  const data = snapshot.val();
  const senderNickname = await getNickname(data.from) || data.from;
  console.log('Received message:', data.message);
  const messageElement = document.createElement('div');
  messageElement.textContent = `${senderNickname}: ${data.message}`;
  chatMessages.appendChild(messageElement);
}

function logUserActivity(activity, nickname) {
  const now = new Date();
  const timestamp = now.toLocaleString();
  const message = `[${timestamp}] ${nickname} ${activity}`;
  const messageElement = document.createElement('div');
  messageElement.textContent = message;
  const chatMessages = document.getElementById('chatMessages');
  if (chatMessages) {
    chatMessages.appendChild(messageElement);
    // Scroll to the bottom of the chat
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } else {
    console.error('Chat messages container not found');
  }
}

async function addUserToList(connectionUserId, connectionNickname) {
    console.log('Adding user to list:', connectionNickname);
    const listItem = document.createElement('div');
    listItem.textContent = connectionNickname;
    listItem.classList.add('List-item');
    listItem.setAttribute('data-user-id', connectionUserId);
    ListContainer.appendChild(listItem);

    // Listen for nickname changes
    onValue(ref(database, `nicknames/${connectionUserId}`), (snapshot) => {
        const updatedNickname = snapshot.val() || connectionNickname;
        listItem.textContent = updatedNickname;
    });
}

function removeUserFromList(connectionUserId) {
  console.log('Removing user from list:', connectionUserId);
  const listItem = ListContainer.querySelector(`[data-user-id="${connectionUserId}"]`);
  if (listItem) {
    ListContainer.removeChild(listItem);
  }
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
  const nicknameInput = document.getElementById('ListNickname');

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

    initWebRTC(userId);
    userNickname = await initializeNickname(userId);
    setupNicknameListener(userId);

    // Log the user in with nickname
    logUserActivity('logged in', userNickname);
  

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

  broadcastBtn.addEventListener('click', async () => {
    if (broadcastBtn.textContent === 'Broadcast') {
      const success = await startBroadcast();
      if (success) {
        broadcastBtn.textContent = 'Stop Broadcast';
      }
    } else {
      stopBroadcast();
      broadcastBtn.textContent = 'Broadcast';
    }
  });

  nicknameInput.addEventListener('change', async () => {
    const newNickname = nicknameInput.value.trim();
    if (newNickname) {
      await setNickname(userId, newNickname);
      console.log('Nickname updated:', newNickname);
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
    // Also remove the nickname when disconnecting
    onDisconnect(ref(database, `nicknames/${userId}`)).remove();
    set(userRef, userNickname);
  
    onChildAdded(connectionsRef, async (snapshot) => {
        const connectionUserId = snapshot.key;
        const connectionNickname = snapshot.val();
        console.log('New user connected:', connectionNickname);
        if (connectionUserId !== userId) {
            await createConnection(connectionUserId);
            await addUserToList(connectionUserId, connectionNickname);
            logUserActivity('logged in', connectionNickname);
        }
    });

    onChildRemoved(connectionsRef, async (snapshot) => {
        const connectionUserId = snapshot.key;
        const connectionNickname = snapshot.val();
        console.log('User disconnected:', connectionNickname);
        removeUserFromList(connectionUserId);
        resetWebcamSpot(connectionUserId);
        closePeerConnection(connectionUserId);
        logUserActivity('logged out', connectionNickname);
        await deleteNickname(connectionUserId);
    });


  onChildAdded(ref(database, 'offers'), handleOffer);
  onChildAdded(ref(database, 'answers'), handleAnswer);
  onChildAdded(ref(database, 'candidates'), handleCandidate);
  onChildAdded(messagesRef, handleMessage);

  voiceBtn.addEventListener('click', () => {
    // Enable voice communication
    // ...
  });
    window.addEventListener('beforeunload', async (event) => {
        // Delete the nickname
        await deleteNickname(userId);
        
        // Log the user out
        logUserActivity('logged out', userNickname);
        
        // Remove the user from the connections list
        const userRef = ref(database, `connections/${userId}`);
        await remove(userRef);

        // Optionally, you can add a confirmation dialog
        event.preventDefault(); // Cancel the event
        event.returnValue = ''; // Chrome requires returnValue to be set
    });
  
});