import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage, connectStorageEmulator } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js";

// Only the dedicated local Hosting emulator uses test credentials and test backends.
// The public BlockClub website always uses the existing production configuration.
const useLocalEmulators = ["localhost", "127.0.0.1"].includes(location.hostname) && location.port === "5000";
const firebaseConfig = useLocalEmulators ? {
  apiKey: "demo-local-key",
  authDomain: "demo-blockclub-e2e.firebaseapp.com",
  projectId: "demo-blockclub-e2e",
  storageBucket: "demo-blockclub-e2e.firebasestorage.app",
  appId: "1:123456789:web:demo-blockclub-e2e"
} : {
  apiKey: "AIzaSyDTz7T-1LddXftWDXM752WIuNdZidYkipA",
  authDomain: "blockclub-4742a.firebaseapp.com",
  projectId: "blockclub-4742a",
  storageBucket: "blockclub-4742a.firebasestorage.app",
  messagingSenderId: "584980019040",
  appId: "1:584980019040:web:7c0c51a002363cb9785005",
  measurementId: "G-RGY6EXRTEN"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

if (useLocalEmulators) {
  const emulatorHost = location.hostname;
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8080);
  connectStorageEmulator(storage, emulatorHost, 9199);
}

export let analytics = null;
if (!useLocalEmulators && await isSupported()) {
  analytics = getAnalytics(app);
}