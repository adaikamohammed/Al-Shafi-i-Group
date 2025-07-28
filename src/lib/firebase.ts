
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
// Remove getDatabase import

const firebaseConfig = {
  apiKey: "AIzaSyCVZOpgoz76g5AQDnPyRTzPB6UoT2YYKL8",
  authDomain: "al-shafi-i-quran-school.web.app",
  projectId: "al-shafi-i-quran-school",
  storageBucket: "al-shafi-i-quran-school.appspot.com",
  messagingSenderId: "833438544513",
  appId: "1:833438544513:web:e141646e143dc4ac851380",
  databaseURL: "https://al-shafi-i-quran-school-default-rtdb.firebaseio.com"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
// Remove db export
const db = null; 

export { app, auth, db };
