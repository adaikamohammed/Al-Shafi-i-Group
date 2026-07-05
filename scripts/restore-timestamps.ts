import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, get, update } from 'firebase/database';

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

// Change this to true to run in dry-run mode
const DRY_RUN = false;

async function run() {
  await signInWithEmailAndPassword(auth, 'admin00@gmail.com', '123456');
  console.log("Logged in successfully to Firebase.");

  // 1. Fetch activity logs
  console.log("Fetching activity logs...");
  const logsRef = ref(db, 'activity_logs');
  const logsSnap = await get(logsRef);
  if (!logsSnap.exists()) {
    console.log("No activity logs found.");
    return;
  }
  const logs = logsSnap.val();
  console.log(`Loaded ${Object.keys(logs).length} log entries.`);

  // 2. Find the earliest ADD_SESSION log for each session ID
  const originalTimestamps: Record<string, number> = {}; // sessionId -> oldestTimestampMs
  
  Object.values(logs).forEach((log: any) => {
    if (log.action === 'ADD_SESSION' && log.targetId && log.timestamp) {
      const sessionId = log.targetId;
      const timestamp = typeof log.timestamp === 'number' ? log.timestamp : Number(log.timestamp);
      
      if (!originalTimestamps[sessionId] || timestamp < originalTimestamps[sessionId]) {
        originalTimestamps[sessionId] = timestamp;
      }
    }
  });
  console.log(`Found original creation timestamps for ${Object.keys(originalTimestamps).length} sessions in activity logs.`);

  // 3. Fetch all users and check their sessions
  console.log("Fetching users data...");
  const usersRef = ref(db, 'users');
  const usersSnap = await get(usersRef);
  if (!usersSnap.exists()) {
    console.log("No users found.");
    return;
  }
  const users = usersSnap.val();

  let sessionsInspected = 0;
  let sessionsToCorrect = 0;
  const updates: Record<string, string> = {};

  for (const userId in users) {
    const userData = users[userId];
    const dailySessions = userData.dailySessions;
    if (!dailySessions) continue;

    const sheikhName = userData.profile?.displayName || userId;

    for (const date in dailySessions) {
      const daySessions = dailySessions[date];
      if (!daySessions || typeof daySessions !== 'object') continue;

      for (const sessionId in daySessions) {
        sessionsInspected++;
        const session = daySessions[sessionId];
        if (!session) continue;

        const originalTimeMs = originalTimestamps[session.id];
        if (originalTimeMs) {
          const originalTimeISO = new Date(originalTimeMs).toISOString();
          const currentTimeISO = session.createdAt;

          // If the stored createdAt is different from our log-determined original time
          if (!currentTimeISO || new Date(currentTimeISO).getTime() > originalTimeMs + 5000) {
            sessionsToCorrect++;
            console.log(`[Session Correction Prepared]`);
            console.log(`  Sheikh: ${sheikhName} (${userId})`);
            console.log(`  Session ID: ${session.id} (Date: ${session.date})`);
            console.log(`  Current createdAt: ${currentTimeISO}`);
            console.log(`  Original (from log): ${originalTimeISO}`);

            updates[`users/${userId}/dailySessions/${date}/${sessionId}/createdAt`] = originalTimeISO;
          }
        }
      }
    }
  }

  console.log(`\nInspection Summary:`);
  console.log(`  Total sessions inspected: ${sessionsInspected}`);
  console.log(`  Sessions needing correction: ${sessionsToCorrect}`);
  
  if (DRY_RUN) {
    console.log(`  [DRY RUN] No databases were modified. Set DRY_RUN = false in the script to apply these changes.`);
  } else {
    if (Object.keys(updates).length > 0) {
      console.log(`Applying ${Object.keys(updates).length} updates in a single batch...`);
      const dbRef = ref(db);
      await update(dbRef, updates);
      console.log(`Successfully corrected ${Object.keys(updates).length} sessions in Firebase database!`);
    } else {
      console.log("No updates needed.");
    }
  }
}

run().catch(console.error);
