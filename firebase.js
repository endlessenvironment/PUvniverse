import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, get } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js";

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