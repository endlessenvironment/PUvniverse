import { getDatabase, ref, push, onChildAdded, onChildRemoved, remove } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js";

const database = getDatabase();
const offersRef = ref(database, 'offers');
const answersRef = ref(database, 'answers');
const candidatesRef = ref(database, 'candidates');

let userId;
const peerConnections = {};
let localStream = null;

function getMaxWebcamSize() {
  return window.innerWidth <= 600 ? 80 : 180; // 80px for mobile, 180px for desktop
}

function calculateResizedDimensions(width, height) {
  const maxSize = getMaxWebcamSize();
  
  if (width <= maxSize && height <= maxSize) {
    return { width, height };
  }
  
  const aspectRatio = width / height;
  if (width > height) {
    return {
      width: maxSize,
      height: Math.round(maxSize / aspectRatio)
    };
  } else {
    return {
      width: Math.round(maxSize * aspectRatio),
      height: maxSize
    };
  }
}

export function initWebRTC(currentUserId) {
  userId = currentUserId;
  window.addEventListener('resize', handleResize);
}

export async function createConnection(connectionUserId) {
  console.log(`Creating connection with user ${connectionUserId}`);
  const peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ]
  });
  peerConnections[connectionUserId] = peerConnection;

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
      
      videoElement.addEventListener('loadedmetadata', () => {
        const { width, height } = calculateResizedDimensions(videoElement.videoWidth, videoElement.videoHeight);
        
        videoElement.style.width = `${width}px`;
        videoElement.style.height = `${height}px`;
      });
    }
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('Sending ICE candidate');
      push(candidatesRef, { from: userId, to: connectionUserId, candidate: event.candidate.toJSON() });
    }
  };

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

export async function handleOffer(snapshot) {
  const data = snapshot.val();
  if (data.to === userId) {
    console.log('Received offer');
    const peerConnection = peerConnections[data.from] || await createConnection(data.from);

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      
      // Check if the offer indicates the stream has stopped
      if (data.offer.sdp.includes('a=inactive') || data.offer.sdp.includes('a=recvonly')) {
        resetWebcamSpot(data.from);
      }
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log('Sending answer');
      push(answersRef, { from: userId, to: data.from, answer });

      remove(snapshot.ref);
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }
}

export async function handleAnswer(snapshot) {
  const data = snapshot.val();
  if (data.to === userId) {
    console.log('Received answer');
    const peerConnection = peerConnections[data.from];
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        remove(snapshot.ref);
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    }
  }
}

export async function handleCandidate(snapshot) {
  const data = snapshot.val();
  if (data.to === userId) {
    console.log('Received ICE candidate');
    const peerConnection = peerConnections[data.from];
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        remove(snapshot.ref);
      } catch (error) {
        console.error('Error handling ICE candidate:', error);
      }
    }
  }
}

export function getAvailableWebcamSpot() {
  const webcamSpots = document.querySelectorAll('.webcam');
  for (let i = 1; i < webcamSpots.length; i++) {
    if (!webcamSpots[i].srcObject) {
      return webcamSpots[i];
    }
  }
  return null;
}

export function resetWebcamSpot(connectionUserId) {
  console.log('Resetting webcam spot for user:', connectionUserId);
  const webcamSpots = document.querySelectorAll('.webcam');
  for (const spot of webcamSpots) {
    if (spot.getAttribute('data-user-id') === connectionUserId) {
      spot.srcObject = null;
      spot.removeAttribute('data-user-id');
      const maxSize = getMaxWebcamSize();
      spot.style.width = `${maxSize}px`;
      spot.style.height = `${maxSize}px`;
      
      break;
    }
  }
}

export async function startBroadcast() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    console.log('Local stream started');
    const localWebcamSpot = document.querySelector('.webcam');
    localWebcamSpot.srcObject = localStream;
    localWebcamSpot.muted = true;

    localWebcamSpot.addEventListener('loadedmetadata', () => {
      const { width, height } = calculateResizedDimensions(localWebcamSpot.videoWidth, localWebcamSpot.videoHeight);
      
      localWebcamSpot.style.width = `${width}px`;
      localWebcamSpot.style.height = `${height}px`;
    });

    Object.keys(peerConnections).forEach(connectionUserId => {
      const peerConnection = peerConnections[connectionUserId];
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    });

    return true;
  } catch (error) {
    console.error('Error accessing media devices:', error);
    return false;
  }
}

export function stopBroadcast() {
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

export function closePeerConnection(connectionUserId) {
  const peerConnection = peerConnections[connectionUserId];
  if (peerConnection) {
    peerConnection.close();
    delete peerConnections[connectionUserId];
  }
}

function handleResize() {
  const webcams = document.querySelectorAll('.webcam');
  webcams.forEach(webcam => {
    if (webcam.videoWidth && webcam.videoHeight) {
      const { width, height } = calculateResizedDimensions(webcam.videoWidth, webcam.videoHeight);
      webcam.style.width = `${width}px`;
      webcam.style.height = `${height}px`;
    }
  });
}