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

  const usersRef = ref(db, `users`);
  const snapshot = await get(usersRef);
  if (!snapshot.exists()) {
    console.log("Could not load users data.");
    return;
  }

  const usersData = snapshot.val();
  for (const uid in usersData) {
    const profile = usersData[uid].profile || {};
    console.log(`UID: ${uid} | Name: ${profile.displayName} | Email: ${profile.email} | Role: ${profile.role} | Group: ${profile.group}`);
  }
}

run().catch(console.error);
