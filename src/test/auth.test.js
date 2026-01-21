import fetch from "node-fetch";

const BASE_URL = "http://localhost:3005"; // or Render URL - https://jm-showroomer-back.onrender.com
const TEST_GOOGLE_ID_TOKEN = "<PUT_YOUR_USER_ID_TOKEN_HERE>";
const TEST_OWNER_ID_TOKEN = "<PUT_YOUR_OWNER_ID_TOKEN_HERE>";

async function test() {
  console.log("=== 1️⃣ Health Check ===");
  let res = await fetch(`${BASE_URL}/health`);
  console.log("Status:", res.status, "Body:", await res.json());

  console.log("\n=== 2️⃣ Access public route without token ===");
  res = await fetch(`${BASE_URL}/users`);
  console.log("Status:", res.status, "Body:", await res.json());

  console.log("\n=== 3️⃣ Access protected route without token ===");
  res = await fetch(`${BASE_URL}/users/dev/register-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  console.log("Status:", res.status, "Body:", await res.json());

  console.log("\n=== 4️⃣ OAuth login with valid user token ===");
  res = await fetch(`${BASE_URL}/auth/oauth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: TEST_GOOGLE_ID_TOKEN }),
  });
  const userData = await res.json();
  console.log("Status:", res.status, "Body:", userData);

  console.log("\n=== 5️⃣ Protected route with user token (should succeed) ===");
  res = await fetch(`${BASE_URL}/users/dev/register-test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TEST_GOOGLE_ID_TOKEN}`,
    },
  });
  console.log("Status:", res.status, "Body:", await res.json());

  console.log("\n=== 6️⃣ Owner route with user token (should fail) ===");
  res = await fetch(`${BASE_URL}/showrooms/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TEST_GOOGLE_ID_TOKEN}`,
    },
  });
  console.log("Status:", res.status, "Body:", await res.json());

  console.log("\n=== 7️⃣ Owner route with owner token (should succeed) ===");
  res = await fetch(`${BASE_URL}/showrooms/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TEST_OWNER_ID_TOKEN}`,
    },
    body: JSON.stringify({ name: "Test Showroom" }),
  });
  console.log("Status:", res.status, "Body:", await res.json());

  console.log("\n=== 8️⃣ Protected route with invalid token (should fail) ===");
  res = await fetch(`${BASE_URL}/users/dev/register-test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer INVALID_TOKEN`,
    },
  });
  console.log("Status:", res.status, "Body:", await res.json());
}

test().catch((err) => console.error(err));
