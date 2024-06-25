import { signIn, getStreams, addStream, listenForStreamUpdates, addOffer, listenForOffers, addAnswer, listenForAnswers, addIceCandidate, listenForIceCandidates } from './firebase.js';

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
  const peerConnections = {};

  const observer = new MutationObserver(() => {
    if (chatMessages.scrollHeight > chatMessages.clientHeight) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  });
  observer.observe(chatMessages, { childList: true });

  document.body.classList.add('loading');
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('hidden');

  const userId = await signIn();

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
    // Handle send message functionality
  });

  talkBtn.addEventListener('click', () => {
    // Handle talk functionality
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
    await startBroadcast(userId);
  });

  async function startBroadcast(userId) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    await addStream(stream, userId);
    const pc = createPeerConnection(userId, stream);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await addOffer(userId, offer);
  }

  function createPeerConnection(userId, localStream) {
    const pc = new RTCPeerConnection();
    peerConnections[userId] = pc;

    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      const videoElement = document.querySelector(`.webcam[data-user-id="${userId}"]`);
      if (videoElement) {
        videoElement.srcObject = remoteStream;
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addIceCandidate(userId, event.candidate);
      }
    };

    return pc;
  }

  listenForStreamUpdates((streams) => {
    streams.forEach((streamData, index) => {
      if (index < webcams.length && streamData.userId !== userId) {
        const videoElement = webcams[index];
        videoElement.setAttribute('data-user-id', streamData.userId);
        playStreamFromData(streamData, videoElement);
      }
    });
  });

  function playStreamFromData(streamData, videoElement) {
    const userId = streamData.userId;
    let pc = peerConnections[userId];

    if (!pc) {
      pc = new RTCPeerConnection();
      peerConnections[userId] = pc;

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        videoElement.srcObject = remoteStream;
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addIceCandidate(userId, event.candidate);
        }
      };
    }

    listenForOffers(async (offerData) => {
      if (offerData.userId === userId && pc.signalingState === 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(offerData.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await addAnswer(userId, answer);
      }
    });

    listenForAnswers(async (answerData) => {
      if (answerData.userId === userId && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answerData.answer));
      }
    });

    listenForIceCandidates(async (candidateData) => {
      if (candidateData.userId === userId) {
        await pc.addIceCandidate(new RTCIceCandidate(candidateData.candidate));
      }
    });
  }

  // Initial load of streams
  const initialStreams = await getStreams();
  initialStreams.forEach((streamData, index) => {
    if (index < webcams.length && streamData.userId !== userId) {
      const videoElement = webcams[index];
      videoElement.setAttribute('data-user-id', streamData.userId);
      playStreamFromData(streamData, videoElement);
    }
  });
});