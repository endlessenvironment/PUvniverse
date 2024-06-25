import { signIn, initLocalStream, createOffer, listenForSignals, auth, sendSignal, sendMessage, listenForMessages, database } from './firebase.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js";
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
  const talkBtn = document.getElementById('talkBtn');

  const observer = new MutationObserver(() => {
    if (chatMessages.scrollHeight > chatMessages.clientHeight) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  });
  observer.observe(chatMessages, { childList: true });

  const displayedMessageIds = new Set();

  document.body.classList.add('loading');
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('hidden');

  await signIn();
  const localStream = await initLocalStream();
  const localVideo = document.getElementById('_0');
  localVideo.srcObject = localStream;

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
    const message = chatInput.value;
    if (message.trim() !== '') {
      const userId = auth.currentUser.uid;
      sendMessage(userId, message);
      chatInput.value = '';
    }
  });

  listenForMessages(messages => {
    chatMessages.innerHTML = ''; // Clear previous messages
    for (const [key, messageData] of Object.entries(messages)) {
      const messageElement = document.createElement('div');
      messageElement.textContent = `${messageData.userId}: ${messageData.message}`;
      chatMessages.appendChild(messageElement);
    }
  });

 auth.onAuthStateChanged(user => {
    if (user) {
      const peerId = user.uid;
      console.log(`Current user ID: ${peerId}`);
      listenForSignals(peerId);

      // Create offer when broadcast button is clicked
      broadcastBtn.addEventListener('click', async () => {
        const connectedClients = await getConnectedClients();
        connectedClients.forEach(clientId => {
          if (clientId !== peerId) {
            console.log(`Creating offer for clientId: ${clientId}`);
            createOffer(clientId);
          }
        });
      });

    }
  });
});

async function getConnectedClients() {
  const signalRef = ref(database, 'signals');
  const snapshot = await get(signalRef);
  const data = snapshot.val();
  console.log('Connected clients:', data);
  return data ? Object.keys(data) : [];
}