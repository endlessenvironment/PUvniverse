import { getDatabase, ref, push, onChildAdded, onChildRemoved, remove } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js";

const database = getDatabase();
const offersRef = ref(database, 'offers');
const answersRef = ref(database, 'answers');
const candidatesRef = ref(database, 'candidates');

let userId;
let localStream = null;
let isBroadcasting = false;
const peerConnections = {};

export function initWebRTC(currentUserId) {
  userId = currentUserId;
}

export async function createConnection(connectionUserId) {
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
      videoElement.onloadedmetadata = () => {
        setWebcamSpotSize(videoElement, remoteStream);
        videoElement.play().catch(error => {
          console.error('Error playing video:', error);
        });
      };
    }
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      push(candidatesRef, { from: userId, to: connectionUserId, candidate: event.candidate.toJSON() });
    }
  };

  peerConnection.onnegotiationneeded = async () => {
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
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
    const peerConnection = peerConnections[data.from] || await createConnection(data.from);

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
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
  const webcamSpots = document.querySelectorAll('.webcam');
  for (const spot of webcamSpots) {
    if (spot.getAttribute('data-user-id') === connectionUserId) {
      spot.srcObject = null;
      spot.removeAttribute('data-user-id');
      spot.style.width = '';
      spot.style.height = '';
      break;
    }
  }
}

function setWebcamSpotSize(videoElement, stream) {
  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings();
  const aspectRatio = settings.width / settings.height;
  
  let maxSize = window.innerWidth <= 600 ? 80 : 180;
  let width = Math.min(settings.width, maxSize);
  let height = width / aspectRatio;
  
  if (height > maxSize) {
    height = maxSize;
    width = height * aspectRatio;
  }
  
  videoElement.style.width = `${width}px`;
  videoElement.style.height = `${height}px`;
}

export async function startBroadcast() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const localWebcamSpot = document.querySelector('.webcam');
    localWebcamSpot.srcObject = localStream;
    localWebcamSpot.muted = true;
    setWebcamSpotSize(localWebcamSpot, localStream);

    Object.keys(peerConnections).forEach(connectionUserId => {
      sendStreamToUser(connectionUserId);
    });

    isBroadcasting = true;
    return true;
  } catch (error) {
    console.error('Error accessing media devices:', error);
    return false;
  }
}

export function stopBroadcast() {
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      track.stop();
    });
    localStream = null;
  }
  const localWebcamSpot = document.querySelector('.webcam');
  localWebcamSpot.srcObject = null;
  localWebcamSpot.style.width = '';
  localWebcamSpot.style.height = '';
  isBroadcasting = false;
}

export function sendStreamToNewUser(connectionUserId) {
  if (isBroadcasting && localStream) {
    sendStreamToUser(connectionUserId);
  }
}

function sendStreamToUser(connectionUserId) {
  const peerConnection = peerConnections[connectionUserId];
  if (peerConnection && localStream) {
    localStream.getTracks().forEach(track => {
      if (!peerConnection.getSenders().find(sender => sender.track === track)) {
        peerConnection.addTrack(track, localStream);
      }
    });
  }
}

export function closePeerConnection(connectionUserId) {
  const peerConnection = peerConnections[connectionUserId];
  if (peerConnection) {
    peerConnection.close();
    delete peerConnections[connectionUserId];
  }
}