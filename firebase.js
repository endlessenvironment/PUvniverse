import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";
import { getDatabase, ref, set, onValue, get, remove } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-storage.js";

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
const storage = getStorage(app);
let videoMediaRecorder;
let audioMediaRecorder;
let videoStream;
let audioStream;

export async function signIn() {
  return signInAnonymously(auth)
    .then(() => {
      console.log('Signed in anonymously');
    })
    .catch((error) => {
      console.error('Error signing in anonymously', error);
    });
}

async function getUserId() {
  const user = auth.currentUser;
  return user ? user.uid : null;
}

export async function getStreamsCount() {
  const streamsRef = ref(database, 'streams');
  const snapshot = await get(streamsRef);
  return snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
}

export async function startVideoBroadcast() {
  const userId = await getUserId();
  if (!userId) return;

  const streamKey = `streams/${userId}`;

  videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  const videoTracks = videoStream.getVideoTracks();
  const videoTrack = videoTracks[0];

  const videoStorageRef = storageRef(storage, `videoStreams/${userId}.webm`);
  videoMediaRecorder = new MediaRecorder(videoStream, { mimeType: 'video/webm' });

  videoMediaRecorder.ondataavailable = async (event) => {
    const blob = new Blob([event.data], { type: 'video/webm' });
    const fileRef = storageRef(storage, `videoStreams/${userId}_${Date.now()}.webm`);
    await uploadBytes(fileRef, blob);
    const videoURL = await getDownloadURL(fileRef);
    console.log('Video URL:', videoURL); // Log the video URL for debugging
    await set(ref(database, streamKey), { videoURL, type: 'video' });
  };

  videoMediaRecorder.start(1000);

  videoTrack.onended = () => {
    videoMediaRecorder.stop();
    stopVideoBroadcast();
  };
}

export async function startAudioBroadcast() {
  const userId = await getUserId();
  if (!userId) return;

  const streamKey = `streams/${userId}`;

  audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  const audioTracks = audioStream.getAudioTracks();
  const audioTrack = audioTracks[0];

  const audioStorageRef = storageRef(storage, `audioStreams/${userId}.webm`);
  audioMediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });

  audioMediaRecorder.ondataavailable = async (event) => {
    const blob = new Blob([event.data], { type: 'audio/webm' });
    const fileRef = storageRef(storage, `audioStreams/${userId}_${Date.now()}.webm`);
    await uploadBytes(fileRef, blob);
    const audioURL = await getDownloadURL(fileRef);
    await set(ref(database, streamKey), { audioURL, type: 'audio' });
  };

  audioMediaRecorder.start(1000);

  audioTrack.onended = () => {
    audioMediaRecorder.stop();
    stopAudioBroadcast();
  };
}

export async function stopVideoBroadcast() {
  if (videoMediaRecorder && videoMediaRecorder.state !== 'inactive') {
    videoMediaRecorder.stop();
  }
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
  }
  const userId = await getUserId();
  if (!userId) return;

  const streamKey = `streams/${userId}`;
  await remove(ref(database, streamKey));
}

export async function stopAudioBroadcast() {
  if (audioMediaRecorder && audioMediaRecorder.state !== 'inactive') {
    audioMediaRecorder.stop();
  }
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
  }
  const userId = await getUserId();
  if (!userId) return;

  const streamKey = `streams/${userId}`;
  await remove(ref(database, streamKey));
}

export function listenToStreams(webcams) {
  const streamsRef = ref(database, 'streams');
  onValue(streamsRef, (snapshot) => {
    console.log('Streams updated:', snapshot.val());
    const streams = snapshot.val() || {};
    const streamKeys = Object.keys(streams);

    streamKeys.forEach((key, index) => {
      if (index < webcams.length) {
        const webcam = webcams[index];
        const stream = streams[key];
        if (stream.type === 'video') {
          webcam.src = '';
          webcam.srcObject = null;
          fetch(stream.videoURL, { mode: 'cors' })
            .then(response => {
              if (response.ok) {
                webcam.src = stream.videoURL;
                webcam.play();
              } else {
                console.error('Video URL is not accessible:', stream.videoURL);
              }
            })
            .catch(error => {
              console.error('Error fetching video URL:', error);
            });
        } else if (stream.type === 'audio') {
          const audio = new Audio(stream.audioURL);
          fetch(stream.audioURL, { mode: 'cors' })
            .then(response => {
              if (response.ok) {
                audio.src = stream.audioURL;
                audio.play();
              } else {
                console.error('Audio URL is not accessible:', stream.audioURL);
              }
            })
            .catch(error => {
              console.error('Error fetching audio URL:', error);
            });
        }
      }
    });

    for (let i = streamKeys.length; i < webcams.length; i++) {
      webcams[i].src = '';
      webcams[i].srcObject = null;
    }
  });
}