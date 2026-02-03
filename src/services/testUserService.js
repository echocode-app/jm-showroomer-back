import { getAuthInstance, getFirestoreInstance, getStorageInstance } from "../config/firebase.js";

// createTestUser
export async function createTestUser() {
  const auth = getAuthInstance();
  const db = getFirestoreInstance();
  const bucket = getStorageInstance().bucket();

  const email = `test_${Date.now()}@jm.dev`;
  const password = "Test12345!";

  const user = await auth.createUser({ email, password });

  await db.collection("users").doc(user.uid).set({
    uid: user.uid,
    email,
    role: "test",
    createdAt: new Date().toISOString(),
  });

  const file = bucket.file(`test/${user.uid}.txt`);
  await file.save("JM Showroomer Firebase OK");

  return { uid: user.uid, email };
}
