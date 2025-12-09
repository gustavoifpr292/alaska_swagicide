import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAKmcYkr8QQkHQjjaPYUdRS4IUfhonbAgU",
  authDomain: "aqmel-app.firebaseapp.com",
  projectId: "aqmel-app",
  storageBucket: "aqmel-app.firebasestorage.app",
  messagingSenderId: "934383779120",
  appId: "1:934383779120:web:7d8e7c42cd0b9a501c5cf5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default db;