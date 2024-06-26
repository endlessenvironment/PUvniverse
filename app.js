import { signIn, sendMessage, onMessageAdded, setStream, onStreamAdded, onStreamRemoved, deleteStream } from './firebase.js';

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
  const openListBtn = document.getElementById('openListBtn');
  const ListWindow = document.getElementById('ListWindow');
  const hideListBtn = document.getElementById('hideListBtn');

  let localStream;
  let userId;
  let isBroadcasting = false;
  let isMicMuted = false;
  let activeStreams = 0;

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
    ListWindow.classList.add('hidden');
    chatWindow.classList.remove('hidden');
  });

  openListBtn.addEventListener('click', (event) => {
    menuContent.style.display = 'none';
    chatWindow.classList.add('hidden');
    ListWindow.classList.remove('hidden');
  });

  hideChatBtn.addEventListener('click', () => {
    chatWindow.classList.add('hidden');
  });

  hideListBtn.addEventListener('click', () => {
    ListWindow.classList.add('hidden');
  });

  voiceBtn.addEventListener('click', toggleMic);
  broadcastBtn.addEventListener('click', toggleBroadcast);

  sendBtn.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message !== '') {
      const nickname = nicknameInput.value || userId;
      sendMessage({ sender: nickname, content: message });
      chatInput.value = '';
    }
  });

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendBtn.click();
    }
  });

  function toggleMic() {
    if (localStream) {
      localStream.getAudioTracks()[0].enabled = !isMicMuted;
      isMicMuted = !isMicMuted;
    }
  }

  function toggleBroadcast() {
    if (isBroadcasting) {
      stopBroadcast();
    } else {
      if (activeStreams < 6) {
        navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          .then((stream) => {
            localStream = stream;
            setStream(userId, localStream);
            isBroadcasting = true;
            activeStreams++;
          });
      } else {
        alert('Broadcasting limit reached. Please try again later.');
      }
    }
  }
  
  function stopBroadcast() {
    if (isBroadcasting) {
      localStream.getTracks().forEach(track => track.stop());
      deleteStream(userId);
      isBroadcasting = false;
      activeStreams--;
	  const videoElement = document.querySelector(`.webcam[data-user-id="${userId}"]`);
      if (videoElement) {
      videoElement.srcObject = null;
      videoElement.dataset.userId = '';
    }
	    localStream = null;
    }
  }
  
  onMessageAdded((message) => {
    const messageElement = document.createElement('div');
    messageElement.textContent = `${message.sender}: ${message.content}`;
    chatMessages.appendChild(messageElement);
  });

  onStreamAdded((userId, streamId) => {
    const videoElements = document.querySelectorAll('.webcam');
    for (let i = 0; i < videoElements.length; i++) {
      if (videoElements[i].srcObject === null) {
        if (streamId) {
          navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then((stream) => {
              videoElements[i].srcObject = stream;
              videoElements[i].dataset.userId = userId;
              activeStreams++;
            });
        } else {
          videoElements[i].srcObject = null;
          videoElements[i].dataset.userId = '';
        }
        break;
      }
    }
  });

  onStreamRemoved((userId) => {
    const videoElements = document.querySelectorAll('.webcam');
    for (let i = 0; i < videoElements.length; i++) {
      if (videoElements[i].dataset.userId === userId) {
        videoElements[i].srcObject = null;
        videoElements[i].dataset.userId = '';
        activeStreams--;
        break;
      }
    }
  });
  
  window.addEventListener('beforeunload', (event) => {
    stopBroadcast();
  });
});