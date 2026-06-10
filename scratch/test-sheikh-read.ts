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

import fs from 'fs';

async function run() {
  const logFile = 'scratch/test-results.txt';
  fs.writeFileSync(logFile, 'Starting permission test...\n');

  try {
    const userCredential = await signInWithEmailAndPassword(auth, 'admin4@gmail.com', '123456');
    const user = userCredential.user;
    fs.appendFileSync(logFile, `Logged in successfully as ${user.email} (UID: ${user.uid}).\n`);

    const subpaths = [
      'profile',
      'dailyReports',
      'admin_logs',
      'weeklyOutcomes',
      'surahProgress',
      'students',
      'settings',
      'dailySessions',
      'activity_logs',
      'payments'
    ];

    for (const subpath of subpaths) {
      const path = `users/${user.uid}/${subpath}`;
      fs.appendFileSync(logFile, `Reading [${subpath}]...\n`);
      try {
        const snapshot = await get(ref(db, path));
        fs.appendFileSync(logFile, `SUCCESS [${subpath}]: Data exists: ${snapshot.exists()}\n`);
      } catch (error: any) {
        fs.appendFileSync(logFile, `FAILED [${subpath}]: ${error.message} (${error.code})\n`);
      }
    }
    fs.appendFileSync(logFile, 'Test complete.\n');
  } catch (err: any) {
    fs.appendFileSync(logFile, `CRITICAL ERROR: ${err.message}\n`);
  }
}

run().then(() => {
  console.log("Finished running.");
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
