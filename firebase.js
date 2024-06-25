import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, get } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js";


const firebaseConfig = {
  apiKey: "AIzaSyCR7f4cihuwGw37oM69v0MAtgRydkmm5b4",
  authDomain: "endlesspuvni.firebaseapp.com",
  databaseURL: "https://endlesspuvni-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "endlesspuvni",
  storageBucket: "endlesspuvni.appspot.com",
  messagingSenderId: "892171551323",
  appId: "1:892171551323:web:9e596a5c80e84df239757e",
  measurementId: "G-6LBL4FJSM9"
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


export async function getStreams() {
  const streamsRef = ref(database, 'streams');
  const snapshot = await get(streamsRef);
  const streams = [];
  snapshot.forEach(childSnapshot => {
    streams.push(childSnapshot.val());
  });
  return streams;
}

export async function addStream(stream) {
  const streamsRef = ref(database, 'streams');
  const newStreamRef = push(streamsRef);

  const pc = new RTCPeerConnection();
  stream.getTracks().forEach(track => pc.addTrack(track, stream));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const streamData = {
    offer: offer
  };

  await set(newStreamRef, streamData);
  return newStreamRef.key;
}

export function listenForStreamUpdates(callback) {
  const streamsRef = ref(database, 'streams');
  onValue(streamsRef, (snapshot) => {
    const streams = [];
    snapshot.forEach(childSnapshot => {
      streams.push(childSnapshot.val());
    });
    callback(streams);
  });
}