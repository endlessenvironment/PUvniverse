import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";

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