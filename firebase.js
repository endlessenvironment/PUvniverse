import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";
import { getDatabase, ref, set, push, onChildAdded, onChildRemoved } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js";

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
const database = getDatabase();

export function signIn() {
  return signInAnonymously(auth)
    .then((userCredential) => {
      console.log('Signed in!', userCredential.user.uid);
      return userCredential.user.uid;
    })
    .catch((error) => {
      console.error('Error signing in!', error);
    });
}

export function sendMessage(message) {
  const messagesRef = ref(database, 'messages');
  return push(messagesRef, message);
}

export function onMessageAdded(callback) {
  const messagesRef = ref(database, 'messages');
  onChildAdded(messagesRef, (snapshot) => {
    const message = snapshot.val();
    callback(message);
  });
}

export function setStream(streamId, stream) {
  const streamRef = ref(database, `streams/${streamId}`);
  return set(streamRef, stream ? stream.id : null);
}

export function onStreamAdded(callback) {
  const streamsRef = ref(database, 'streams');
  onChildAdded(streamsRef, (snapshot) => {
    const streamId = snapshot.key;
    const streamValue = snapshot.val();
    if (streamValue) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then((stream) => {
          callback(streamId, stream);
        });
    } else {
      callback(streamId, null);
    }
  });
}

export function onStreamRemoved(callback) {
  const streamsRef = ref(database, 'streams');
  onChildRemoved(streamsRef, (snapshot) => {
    const streamId = snapshot.key;
    callback(streamId);
  });
}

export function deleteStream(streamId) {
  const streamRef = ref(database, `streams/${streamId}`);
  return set(streamRef, null);
}