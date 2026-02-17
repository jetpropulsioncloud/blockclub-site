import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js";

const firebaseConfig = {
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

export let analytics = null;
if (await isSupported()) analytics = getAnalytics(app);