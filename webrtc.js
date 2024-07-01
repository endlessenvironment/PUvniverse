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
    
    // Use the 'loadedmetadata' event to ensure the video is ready to play
    videoElement.onloadedmetadata = () => {
      console.log('Video metadata loaded, attempting to play');
      videoElement.play().then(() => {
        console.log('Video playback started successfully');
      }).catch(error => {
        console.error('Error playing video:', error);
        // If autoplay fails, we could show a play button to the user
        showPlayButton(videoElement);
      });
    };
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

    Object.keys(peerConnections).forEach(connectionUserId => {
      sendStreamToUser(connectionUserId);
    });

    isBroadcasting = true;
    console.log('Broadcasting started, isBroadcasting set to:', isBroadcasting);
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
  isBroadcasting = false;
  console.log('Broadcasting stopped, isBroadcasting set to:', isBroadcasting);
}

export function sendStreamToNewUser(connectionUserId) {
  console.log('Attempting to send stream to new user:', connectionUserId);
  console.log('isBroadcasting:', isBroadcasting);
  console.log('localStream:', localStream);
  if (isBroadcasting && localStream) {
    console.log('Conditions met, sending stream to user');
    sendStreamToUser(connectionUserId);
  } else {
    console.log('Not broadcasting or no local stream available');
  }
}

function sendStreamToUser(connectionUserId) {
  console.log('sendStreamToUser called for:', connectionUserId);
  const peerConnection = peerConnections[connectionUserId];
  console.log('peerConnection:', peerConnection);
  if (peerConnection && localStream) {
    console.log('Checking and adding tracks to peer connection');
    localStream.getTracks().forEach(track => {
      if (!peerConnection.getSenders().find(sender => sender.track === track)) {
        console.log('Adding track:', track.kind);
        peerConnection.addTrack(track, localStream);
      } else {
        console.log('Track already exists:', track.kind);
      }
    });
  } else {
    console.log('Unable to add tracks: peerConnection or localStream is missing');
  }
}


export function closePeerConnection(connectionUserId) {
  const peerConnection = peerConnections[connectionUserId];
  if (peerConnection) {
    peerConnection.close();
    delete peerConnections[connectionUserId];
  }
}