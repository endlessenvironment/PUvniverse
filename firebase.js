import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB35b_fBDqQ9QXKPHhgFByk_VKW39todRg",
  authDomain: "endlesspuvniverse.firebaseapp.com",
  databaseURL: "https://endlesspuvniverse-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "endlesspuvniverse",
  storageBucket: "endlesspuvniverse.appspot.com",
  messagingSenderId: "489205825944",
  appId: "1:489205825944:web:411bd957f3bdb308ab2bed",
  measurementId: "G-B5JP295M8C"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const database = getDatabase(app);

export function signIn() {
  return signInAnonymously(auth)
    .then(() => {
      console.log('Signed!');
    })
    .catch((error) => {
      console.error('Error!', error);
    });
}
export { auth, database };

const servers = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302'
    }
  ]
};

let peerConnections = {};
let candidateQueues = {};
let localStream;

export async function initLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const localVideo = document.getElementById('_0');
    if (localVideo) {
      localVideo.srcObject = localStream;
      console.log('Local stream initialized and attached to local video element.');
    } else {
      console.error('Local video element not found');
    }
    return localStream;
  } catch (error) {
    console.error('Error initializing local stream:', error);
  }
}

export function closePeerConnection(peerId) {
  const peerConnection = peerConnections[peerId];
  if (peerConnection) {
    peerConnection.close();
    delete peerConnections[peerId];
    console.log(`Closed and removed peer connection for ${peerId}`);
  }
}

export function connectToPeer(peerId) {
  closePeerConnection(peerId); // Close any existing connection for the peer

  const peerConnection = new RTCPeerConnection(servers);
  peerConnections[peerId] = peerConnection;
  candidateQueues[peerId] = [];

  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
      console.log(`Added track: ${track.kind}`);
    });
  } else {
    console.error('Local stream not found');
  }

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      const candidate = {
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
        candidate: event.candidate.candidate
      };
      sendSignal(peerId, { type: 'candidate', candidate: candidate });
      console.log('Sent ICE candidate:', candidate);
    }
  };

  peerConnection.ontrack = event => {
    console.log('Remote track received:', event.streams[0]);
    const remoteVideo = document.getElementById(`remoteVideo_${peerId}`);
    if (remoteVideo) {
      remoteVideo.srcObject = event.streams[0];
      console.log('Attached remote stream to remote video element.');
    } else {
      console.error('Remote video element not found');
    }
  };

  return peerConnection;
}

export async function createOffer(peerId) {
  let peerConnection = peerConnections[peerId];
  if (!peerConnection) {
    peerConnection = connectToPeer(peerId);
  }
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  console.log(`Creating offer for ${peerId}:`, offer);
  sendSignal(peerId, { type: 'offer', offer: offer });
}

export async function createAnswer(peerId, offer) {
  let peerConnection = peerConnections[peerId];
  if (!peerConnection) {
    peerConnection = connectToPeer(peerId);
  }
  console.log(`Setting remote description for ${peerId}`);
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  console.log(`Remote description set for ${peerId}`);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  console.log(`Creating answer for ${peerId}:`, answer);
  sendSignal(peerId, { type: 'answer', answer: answer });

  // Add any queued ICE candidates
  const queuedCandidates = candidateQueues[peerId];
  while (queuedCandidates && queuedCandidates.length > 0) {
    const candidate = queuedCandidates.shift();
    console.log(`Adding queued ICE candidate for ${peerId}:`, candidate);
    peerConnection.addIceCandidate(candidate).catch(error => {
      console.error(`Error adding queued ICE candidate for ${peerId}`, error);
    });
  }
}

export function handleSignal(peerId, data) {
  const senderId = data.sender;
  const currentUserId = auth.currentUser.uid;

  // Ignore signals sent by the current client
  if (senderId === currentUserId) {
    return;
  }

  console.log(`Handling signal from ${senderId} for ${peerId}:`, data);
  let peerConnection = peerConnections[peerId];
  if (!peerConnection) {
    console.log(`PeerConnection for ${peerId} does not exist. Creating a new one.`);
    peerConnection = connectToPeer(peerId);
  }

  switch (data.type) {
    case 'offer':
      if (peerConnection.signalingState === 'have-remote-offer' || peerConnection.signalingState === 'have-local-offer' || peerConnection.signalingState === 'stable') {
        console.log(`Ignoring offer from ${senderId} because signaling state is ${peerConnection.signalingState}`);
        return;
      }
      console.log(`Received offer from ${senderId}:`, data.offer);
      createAnswer(peerId, data.offer);
      break;
    case 'answer':
      if (peerConnection.signalingState !== 'have-local-offer') {
        console.log(`Ignoring answer from ${senderId} because signaling state is ${peerConnection.signalingState}`);
        return;
      }
      console.log(`Received answer from ${senderId}:`, data.answer);
      peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer)).then(() => {
        console.log(`Remote description set for ${peerId}`);

        // Add any queued ICE candidates
        const queuedCandidates = candidateQueues[peerId];
        while (queuedCandidates && queuedCandidates.length > 0) {
          const candidate = queuedCandidates.shift();
          console.log(`Adding queued ICE candidate for ${peerId}:`, candidate);
          peerConnection.addIceCandidate(candidate).catch(error => {
            console.error(`Error adding queued ICE candidate for ${peerId}`, error);
          });
        }
      }).catch(error => {
        console.error(`Error setting remote description for ${peerId}`, error);
      });
      break;
    case 'candidate':
      console.log(`Received candidate from ${senderId}:`, data.candidate);
      if (data.candidate && data.candidate.candidate && data.candidate.sdpMid && data.candidate.sdpMLineIndex !== null) {
        if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
          peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(error => {
            console.error(`Error adding ICE candidate for ${peerId}`, error);
          });
        } else {
          console.log(`Queueing ICE candidate for ${peerId} until remote description is set.`);
          candidateQueues[peerId].push(new RTCIceCandidate(data.candidate));
        }
      } else {
        console.warn('Invalid ICE candidate:', data.candidate);
      }
      break;
  }
}
export function sendSignal(peerId, data) {
  const senderId = auth.currentUser.uid;
  data.sender = senderId;  // Add sender ID to the signal data
  console.log(`Sending signal to ${peerId}:`, data);
  const signalRef = ref(database, `signals/${peerId}`);
  push(signalRef, data)
    .then(() => {
      console.log('Signal sent:', data);
      console.log(`Signal path: signals/${peerId}`);
    })
    .catch((error) => console.error('Error sending signal:', error));
}

export function listenForSignals(peerId) {
  const signalRef = ref(database, `signals/${peerId}`);
  onValue(signalRef, snapshot => {
    const data = snapshot.val();
    if (data) {
      console.log(`Received signals for ${peerId}:`, data);
      Object.values(data).forEach(signal => handleSignal(peerId, signal));
    } else {
      console.log(`No signals found for ${peerId}`);
    }
  });
}

export function sendMessage(userId, message) {
  const messageRef = ref(database, 'messages');
  push(messageRef, { userId, message })
    .then(() => {
      console.log('Message sent:', message);
    })
    .catch((error) => console.error('Error sending message:', error));
}

export function listenForMessages(callback) {
  const messageRef = ref(database, 'messages');
  onValue(messageRef, snapshot => {
    const messages = snapshot.val();
    console.log('Received messages:', messages);
    callback(messages);
  });
}