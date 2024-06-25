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
    .then((userCredential) => {
      console.log('Signed in anonymously');
      return userCredential.user.uid; // Return the user ID
    })
    .catch((error) => {
      console.error('Error signing in anonymously', error);
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

export async function addStream(stream, userId) {
  const streamsRef = ref(database, 'streams');
  const newStreamRef = push(streamsRef);
  const streamData = { tracks: [], userId: userId };

  stream.getTracks().forEach(track => {
    streamData.tracks.push({
      kind: track.kind,
      id: track.id,
      label: track.label,
      enabled: track.enabled,
      settings: track.getSettings(),
      constraints: track.getConstraints()
    });
  });

  await set(newStreamRef, streamData);
  return newStreamRef.key;
}

export async function addOffer(userId, offer) {
  const offersRef = ref(database, `offers/${userId}`);
  await set(offersRef, { userId, offer });
}

export async function addAnswer(userId, answer) {
  const answersRef = ref(database, `answers/${userId}`);
  await set(answersRef, { userId, answer });
}

export async function addIceCandidate(userId, candidate) {
  const candidatesRef = ref(database, `candidates/${userId}`);
  await push(candidatesRef, { userId, candidate });
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

export function listenForOffers(callback) {
  const offersRef = ref(database, 'offers');
  onValue(offersRef, (snapshot) => {
    snapshot.forEach(childSnapshot => {
      callback(childSnapshot.val());
    });
  });
}

export function listenForAnswers(callback) {
  const answersRef = ref(database, 'answers');
  onValue(answersRef, (snapshot) => {
    snapshot.forEach(childSnapshot => {
      callback(childSnapshot.val());
    });
  });
}

export function listenForIceCandidates(callback) {
  const candidatesRef = ref(database, 'candidates');
  onValue(candidatesRef, (snapshot) => {
    snapshot.forEach(childSnapshot => {
      callback(childSnapshot.val());
    });
  });
}