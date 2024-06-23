import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, get } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-database.js";

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
const messagesRef = ref(database, 'messages');

export function signIn() {
  return signInAnonymously(auth)
    .then(() => {
      console.log('Signed!');
    })
    .catch((error) => {
      console.error('Error!', error);
    });
}

export async function sendMessage(text) {
  const ip = await getIpAddress();
  const newMessageRef = push(messagesRef);
  await set(newMessageRef, {
    user: ip,
    text,
    timestamp: Date.now()
  });
}

// Receive messages
export function receiveMessages(callback) {
  onValue(messagesRef, (snapshot) => {
    const messages = snapshot.val();
    callback(messages);
  });
}

async function getIpAddress() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    return 'Unknown IP';
  }
}