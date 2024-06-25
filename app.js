import { signIn, getStreams, addStream, listenForStreamUpdates } from './firebase.js';

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
  const webcams = document.querySelectorAll('.webcam'); // Ensure this is in the correct scope

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

  const userId = await signIn();  // Ensure userId is set after sign-in

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

  });

  talkBtn.addEventListener('click', () => {

  });

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendBtn.click();
    }
  });
  broadcastBtn.addEventListener('click', async () => {
    const streams = await getStreams();
    if (streams.length >= 6) {
      alert('Maximum number of streams reached.');
      return;
    }
    startBroadcast(userId);
  });

  async function startBroadcast(userId) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    await addStream(stream, userId);
    // No need to play the stream locally, it will be retrieved and played from the database
  }

  async function playStreamFromData(streamData, videoElement) {
    const pc = new RTCPeerConnection();

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      videoElement.srcObject = remoteStream;
    };

    const remoteStream = new MediaStream();
    streamData.tracks.forEach(async (trackData) => {
      const track = await getRemoteTrack(trackData);
      if (track) {
        remoteStream.addTrack(track);
      }
    });

    pc.addStream(remoteStream);
  }

  async function getRemoteTrack(trackData) {
    // Simulating retrieval of a remote track
    const constraints = {
      video: trackData.kind === 'video',
      audio: trackData.kind === 'audio'
    };
    const localStream = await navigator.mediaDevices.getUserMedia(constraints);
    return localStream.getTracks().find(track => track.kind === trackData.kind);
  }

  listenForStreamUpdates((streams) => {
    streams.forEach((streamData, index) => {
      if (index < webcams.length && streamData.userId !== userId) {
        playStreamFromData(streamData, webcams[index]);
      }
    });
  });

  // Initial load of streams
  const initialStreams = await getStreams();
  initialStreams.forEach((streamData, index) => {
    if (index < webcams.length && streamData.userId !== userId) {
      playStreamFromData(streamData, webcams[index]);
    }
  });
});