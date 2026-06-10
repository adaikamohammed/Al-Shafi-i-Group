import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, get } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCVZOpgoz76g5AQDnPyRTzPB6UoT2YYKL8",
  authDomain: "al-shafi-i-quran-school.web.app",
  projectId: "al-shafi-i-quran-school",
  storageBucket: "al-shafi-i-quran-school.appspot.com",
  messagingSenderId: "833438544513",
  appId: "1:833438544513:web:e141646e143dc4ac851380",
  databaseURL: "https://al-shafi-i-quran-school-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

async function run() {
  await signInWithEmailAndPassword(auth, 'admin00@gmail.com', '123456');
  console.log("Logged in successfully.");

  const targetUser = 'fKc1bWRZbeX65Feagwfq6h95dqQ2';
  
  // Check 2025-07-29
  const ref1 = ref(db, `users/${targetUser}/dailySessions/2025-07-29`);
  const snap1 = await get(ref1);
  console.log("2025-07-29 sessions:", JSON.stringify(snap1.val(), null, 2));

  // Check 2026-01-29
  const ref2 = ref(db, `users/${targetUser}/dailySessions/2026-01-29`);
  const snap2 = await get(ref2);
  console.log("2026-01-29 sessions:", JSON.stringify(snap2.val(), null, 2));
}

run().catch(console.error);
