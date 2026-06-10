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
  for (const userId in usersData) {
    const u = usersData[userId];
    const dailySessions = u.dailySessions;
    if (!dailySessions) continue;

    for (const date in dailySessions) {
      const daySessions = Object.values(dailySessions[date]);
      daySessions.forEach((session: any) => {
        const num = session.sessionNumber;
        if (num === undefined) {
          console.log(`User: ${userId}, Date: ${date}, Session ID: ${session.id} has NO sessionNumber!`);
        } else if (typeof num !== 'number') {
          console.log(`User: ${userId}, Date: ${date}, Session ID: ${session.id} has sessionNumber as ${typeof num}: "${num}"`);
        } else if (num === 2 && daySessions.length === 1) {
          console.log(`User: ${userId}, Date: ${date}, Session ID: ${session.id} is sessionNumber 2, but is the ONLY session on this day!`);
        }
      });
    }
  }
}

run().catch(console.error);
