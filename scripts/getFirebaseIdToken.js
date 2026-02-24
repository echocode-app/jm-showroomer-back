import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCKG_oI5avZzeM56ZN7euSU7tP4jVLMCX0",
  authDomain: "jm-showroom.firebaseapp.com",
  projectId: "jm-showroom",
  appId: "1:725198091196:web:500025b57d7fdc2e29f1b9",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function login() {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);

  const user = result.user;
  const idToken = await user.getIdToken(true);

  console.log("\n🔥 FIREBASE ID TOKEN 🔥\n");
  console.log(idToken);
  console.log("\nUID:", user.uid);
  console.log("EMAIL:", user.email);
}

login().catch(console.error);
