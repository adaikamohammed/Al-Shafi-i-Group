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
  let totalStudents = 0;
  let sheikhsStudents = 0;
  let ustadhatsStudents = 0;
  let othersStudents = 0;

  function getAdminNumber(email: string): number | null {
    const match = (email || '').toLowerCase().match(/admin(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  function getGroupNumber(group: string): number | null {
    const match = (group || '').match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  }

  function isSheikhMenUser(u: any): boolean {
    if (!u) return false;
    const emailNum = getAdminNumber(u.email || '');
    const groupNum = getGroupNumber(u.group || '');
    const displayName = u.displayName || '';
    return (emailNum !== null && emailNum >= 1 && emailNum <= 9) || 
           (groupNum !== null && groupNum >= 1 && groupNum <= 9) ||
           displayName.includes('الشيخ');
  }

  function isSheikhWomenUser(u: any): boolean {
    if (!u) return false;
    const emailNum = getAdminNumber(u.email || '');
    const groupNum = getGroupNumber(u.group || '');
    const displayName = u.displayName || '';
    return (emailNum !== null && emailNum >= 10 && emailNum <= 18) || 
           (groupNum !== null && groupNum >= 10 && groupNum <= 18) ||
           displayName.includes('الأستاذة');
  }

  const userEntries = Object.entries(usersData);
  console.log(`Loaded ${userEntries.length} users.`);

  userEntries.forEach(([uid, userData]: [string, any]) => {
    const profile = userData.profile || {};
    const students = userData.students || {};
    const studentCount = Object.keys(students).length;
    
    const isMen = isSheikhMenUser({ ...profile, email: profile.email });
    const isWomen = isSheikhWomenUser({ ...profile, email: profile.email });

    console.log(`User ${profile.displayName || 'No Name'} (${profile.email || 'No Email'}, Group: ${profile.group || 'No Group'}): ${studentCount} students. isMen=${isMen}, isWomen=${isWomen}`);
    
    totalStudents += studentCount;
    if (isMen) sheikhsStudents += studentCount;
    else if (isWomen) ustadhatsStudents += studentCount;
    else othersStudents += studentCount;
  });

  console.log("--------------------------------------");
  console.log(`Total Students: ${totalStudents}`);
  console.log(`Sheikhs' Students (1-9): ${sheikhsStudents}`);
  console.log(`Ustadhats' Students (10-18): ${ustadhatsStudents}`);
  console.log(`Others' Students: ${othersStudents}`);
}

run().catch(console.error);
