import fs from "fs";

const outPath = "docs/postman/JM_Showroomer_All_Scenarios.postman_collection.json";

function testScript({ statuses = [200], setVars = [], requireSuccess = false, saveCursor = false }) {
  const lines = [];
  lines.push(`pm.test("Status is ${statuses.join("/")}", function () { pm.expect(${JSON.stringify(statuses)}).to.include(pm.response.code); });`);
  lines.push("let json = null;");
  lines.push("try { json = pm.response.json(); } catch (e) { json = null; }");

  if (requireSuccess) {
    lines.push("pm.test('Envelope success=true', function () {");
    lines.push("  pm.expect(json).to.be.an('object');");
    lines.push("  pm.expect(json.success).to.eql(true);");
    lines.push("});");
  }

  if (saveCursor) {
    lines.push("if (json && json.meta && json.meta.nextCursor) { pm.environment.set('next_cursor', json.meta.nextCursor); }");
  }

  for (const v of setVars) {
    lines.push(`if (json && ${v.expr}) { pm.environment.set(${JSON.stringify(v.key)}, ${v.valueExpr}); }`);
  }

  return [{ type: "text/javascript", exec: lines }];
}

function req({ name, method, path, authVar = null, query = [], body = null, tests }) {
  const headers = [];
  if (authVar) {
    headers.push({ key: "Authorization", value: `{{${authVar}}}` });
  }
  if (body) {
    headers.push({ key: "Content-Type", value: "application/json" });
  }

  const url = {
    raw: `{{baseUrl}}${path}${query.length ? `?${query.map((q) => `${q.key}=${q.value}`).join("&")}` : ""}`,
    host: ["{{baseUrl}}"],
    path: path.split("/").filter(Boolean),
    query,
  };

  return {
    name,
    event: tests ? [{ listen: "test", script: tests }] : [],
    request: {
      method,
      header: headers,
      url,
      body: body
        ? {
            mode: "raw",
            raw: JSON.stringify(body, null, 2),
            options: { raw: { language: "json" } },
          }
        : undefined,
    },
    response: [],
  };
}

const items = [
  {
    name: "00 Smoke",
    item: [
      req({ name: "Health", method: "GET", path: "/health", tests: testScript({ statuses: [200], requireSuccess: false }) }),
      req({ name: "OAuth user (set auth_user)", method: "POST", path: "/auth/oauth", body: { idToken: "{{idToken_user}}" }, tests: testScript({ statuses: [200], requireSuccess: true, setVars: [{ key: "auth_user", expr: "json && json.data && json.data.idToken", valueExpr: "'Bearer ' + json.data.idToken" }] }) }),
      req({ name: "OAuth owner (set auth_owner)", method: "POST", path: "/auth/oauth", body: { idToken: "{{idToken_owner}}" }, tests: testScript({ statuses: [200], requireSuccess: true, setVars: [{ key: "auth_owner", expr: "json && json.data && json.data.idToken", valueExpr: "'Bearer ' + json.data.idToken" }] }) }),
      req({ name: "OAuth admin (set auth_admin)", method: "POST", path: "/auth/oauth", body: { idToken: "{{idToken_admin}}" }, tests: testScript({ statuses: [200], requireSuccess: true, setVars: [{ key: "auth_admin", expr: "json && json.data && json.data.idToken", valueExpr: "'Bearer ' + json.data.idToken" }] }) }),
      req({ name: "Showrooms list", method: "GET", path: "/showrooms", tests: testScript({ statuses: [200], requireSuccess: true, saveCursor: true, setVars: [{ key: "showroom_id", expr: "json && json.data && Array.isArray(json.data.items) && json.data.items[0] && json.data.items[0].id", valueExpr: "json.data.items[0].id" }] }) }),
      req({ name: "Lookbooks list", method: "GET", path: "/lookbooks", query: [{ key: "country", value: "Ukraine" }, { key: "limit", value: "2" }], tests: testScript({ statuses: [200], requireSuccess: true, saveCursor: true, setVars: [{ key: "lookbook_id", expr: "json && json.data && Array.isArray(json.data.items) && json.data.items[0] && json.data.items[0].id", valueExpr: "json.data.items[0].id" }] }) }),
      req({ name: "Events list", method: "GET", path: "/events", tests: testScript({ statuses: [200], requireSuccess: true, saveCursor: true, setVars: [{ key: "event_id", expr: "json && json.data && Array.isArray(json.data.items) && json.data.items[0] && json.data.items[0].id", valueExpr: "json.data.items[0].id" }] }) }),
    ],
  },
  {
    name: "01 Auth + Users",
    item: [
      req({ name: "OAuth missing token", method: "POST", path: "/auth/oauth", body: {}, tests: testScript({ statuses: [400] }) }),
      req({ name: "Get my profile", method: "GET", path: "/users/me", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Update profile valid", method: "PATCH", path: "/users/profile", authVar: "auth_user", body: { appLanguage: "uk", notificationsEnabled: true }, tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Complete onboarding", method: "POST", path: "/users/complete-onboarding", authVar: "auth_user", body: {}, tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Complete owner profile", method: "POST", path: "/users/complete-owner-profile", authVar: "auth_user", body: { name: "Owner Test", country: "Ukraine", instagram: "https://instagram.com/owner_test", position: "Owner" }, tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Register device", method: "POST", path: "/users/me/devices", authVar: "auth_user", body: { deviceId: "ios-docs-device-1", fcmToken: "fake-fcm-token-1", platform: "ios", appVersion: "1.0.0", locale: "uk-UA" }, tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Delete device", method: "DELETE", path: "/users/me/devices/ios-docs-device-1", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "List notifications", method: "GET", path: "/users/me/notifications", authVar: "auth_owner", query: [{ key: "limit", value: "20" }], tests: testScript({ statuses: [200], requireSuccess: true, setVars: [{ key: "notification_id", expr: "json && json.data && Array.isArray(json.data.items) && json.data.items[0] && json.data.items[0].id", valueExpr: "json.data.items[0].id" }], saveCursor: true }) }),
      req({ name: "Unread notifications count", method: "GET", path: "/users/me/notifications/unread-count", authVar: "auth_owner", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Mark notification read", method: "PATCH", path: "/users/me/notifications/{{notification_id}}/read", authVar: "auth_owner", tests: testScript({ statuses: [200], requireSuccess: true }) }),
    ],
  },
  {
    name: "02 Showrooms",
    item: [
      req({ name: "Create draft showroom", method: "POST", path: "/showrooms/draft", authVar: "auth_owner", body: { name: "Flow Showroom", country: "Ukraine" }, tests: testScript({ statuses: [200, 201], requireSuccess: true, setVars: [{ key: "showroom_id", expr: "json && json.data && json.data.showroom && json.data.showroom.id", valueExpr: "json.data.showroom.id" }] }) }),
      req({ name: "Update showroom", method: "PATCH", path: "/showrooms/{{showroom_id}}", authVar: "auth_owner", body: { city: "Kyiv", address: "Khreshchatyk 1", contacts: { phone: "+380501112233", instagram: "https://instagram.com/flow_showroom" } }, tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Submit showroom", method: "POST", path: "/showrooms/{{showroom_id}}/submit", authVar: "auth_owner", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Get showroom by id", method: "GET", path: "/showrooms/{{showroom_id}}", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Showroom share payload", method: "GET", path: "/showrooms/{{showroom_id}}/share", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Showroom counters", method: "GET", path: "/showrooms/counters", query: [{ key: "city", value: "Kyiv" }], tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Showroom suggestions", method: "GET", path: "/showrooms/suggestions", query: [{ key: "q", value: "ky" }], tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Showrooms pagination page1", method: "GET", path: "/showrooms", query: [{ key: "limit", value: "2" }], tests: testScript({ statuses: [200], requireSuccess: true, saveCursor: true }) }),
      req({ name: "Showrooms pagination page2", method: "GET", path: "/showrooms", query: [{ key: "limit", value: "2" }, { key: "cursor", value: "{{next_cursor}}" }], tests: testScript({ statuses: [200], requireSuccess: true, saveCursor: true }) }),
      req({ name: "Favorite showroom", method: "POST", path: "/showrooms/{{showroom_id}}/favorite", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Favorite showroom again (idempotent)", method: "POST", path: "/showrooms/{{showroom_id}}/favorite", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Unfavorite showroom", method: "DELETE", path: "/showrooms/{{showroom_id}}/favorite", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Unfavorite showroom again (idempotent)", method: "DELETE", path: "/showrooms/{{showroom_id}}/favorite", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
    ],
  },
  {
    name: "03 Admin",
    item: [
      req({ name: "Admin overview", method: "GET", path: "/admin/overview", authVar: "auth_admin", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Admin list showrooms", method: "GET", path: "/admin/showrooms", authVar: "auth_admin", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Admin showroom details", method: "GET", path: "/admin/showrooms/{{showroom_id}}", authVar: "auth_admin", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Admin showroom history", method: "GET", path: "/admin/showrooms/{{showroom_id}}/history", authVar: "auth_admin", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Admin showroom stats", method: "GET", path: "/admin/showrooms/{{showroom_id}}/stats", authVar: "auth_admin", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Admin approve showroom", method: "POST", path: "/admin/showrooms/{{showroom_id}}/approve", authVar: "auth_admin", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Admin analytics showrooms", method: "GET", path: "/admin/analytics/showrooms", authVar: "auth_admin", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Admin analytics events", method: "GET", path: "/admin/analytics/events", authVar: "auth_admin", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Admin analytics platform", method: "GET", path: "/admin/analytics/platform", authVar: "auth_admin", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Admin analytics users onboarding", method: "GET", path: "/admin/analytics/users-onboarding", authVar: "auth_admin", tests: testScript({ statuses: [200], requireSuccess: true }) }),
    ],
  },
  {
    name: "04 Lookbooks",
    item: [
      req({ name: "Create lookbook", method: "POST", path: "/lookbooks/create", authVar: "auth_owner", body: { imageUrl: "https://example.com/lookbook.jpg", showroomId: "{{showroom_id}}", description: "Lookbook flow" }, tests: testScript({ statuses: [200, 201], requireSuccess: true, setVars: [{ key: "lookbook_id", expr: "json && json.data && json.data.lookbook && json.data.lookbook.id", valueExpr: "json.data.lookbook.id" }] }) }),
      req({ name: "List lookbooks with pagination", method: "GET", path: "/lookbooks", query: [{ key: "country", value: "Ukraine" }, { key: "limit", value: "2" }], tests: testScript({ statuses: [200], requireSuccess: true, saveCursor: true }) }),
      req({ name: "Lookbooks page2", method: "GET", path: "/lookbooks", query: [{ key: "country", value: "Ukraine" }, { key: "limit", value: "2" }, { key: "cursor", value: "{{next_cursor}}" }], tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Get lookbook by id", method: "GET", path: "/lookbooks/{{lookbook_id}}", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Favorite lookbook", method: "POST", path: "/lookbooks/{{lookbook_id}}/favorite", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Favorite lookbook again (idempotent)", method: "POST", path: "/lookbooks/{{lookbook_id}}/favorite", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Unfavorite lookbook", method: "DELETE", path: "/lookbooks/{{lookbook_id}}/favorite", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Unfavorite lookbook again (idempotent)", method: "DELETE", path: "/lookbooks/{{lookbook_id}}/favorite", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Lookbook RSVP (MVP-limited)", method: "POST", path: "/lookbooks/{{lookbook_id}}/rsvp", authVar: "auth_user", tests: testScript({ statuses: [200, 501] }) }),
    ],
  },
  {
    name: "05 Events",
    item: [
      req({ name: "List events", method: "GET", path: "/events", query: [{ key: "limit", value: "2" }], tests: testScript({ statuses: [200], requireSuccess: true, saveCursor: true, setVars: [{ key: "event_id", expr: "json && json.data && Array.isArray(json.data.items) && json.data.items[0] && json.data.items[0].id", valueExpr: "json.data.items[0].id" }] }) }),
      req({ name: "Get event by id", method: "GET", path: "/events/{{event_id}}", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Want to visit", method: "POST", path: "/events/{{event_id}}/want-to-visit", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Want to visit again (idempotent)", method: "POST", path: "/events/{{event_id}}/want-to-visit", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Remove want-to-visit", method: "DELETE", path: "/events/{{event_id}}/want-to-visit", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Remove want-to-visit again (idempotent)", method: "DELETE", path: "/events/{{event_id}}/want-to-visit", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Dismiss event", method: "POST", path: "/events/{{event_id}}/dismiss", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Dismiss again (idempotent)", method: "POST", path: "/events/{{event_id}}/dismiss", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Undismiss event", method: "DELETE", path: "/events/{{event_id}}/dismiss", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Undismiss again (idempotent)", method: "DELETE", path: "/events/{{event_id}}/dismiss", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Event RSVP (MVP2-only)", method: "POST", path: "/events/{{event_id}}/rsvp", authVar: "auth_user", tests: testScript({ statuses: [501] }) }),
    ],
  },
  {
    name: "06 Collections Sync",
    item: [
      req({ name: "List favorite showrooms", method: "GET", path: "/collections/favorites/showrooms", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Sync favorite showrooms", method: "POST", path: "/collections/favorites/showrooms/sync", authVar: "auth_user", body: { favoriteIds: ["{{showroom_id}}"] }, tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "List favorite lookbooks", method: "GET", path: "/collections/favorites/lookbooks", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Sync favorite lookbooks", method: "POST", path: "/collections/favorites/lookbooks/sync", authVar: "auth_user", body: { favoriteIds: ["{{lookbook_id}}"] }, tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "List want-to-visit events", method: "GET", path: "/collections/want-to-visit/events", authVar: "auth_user", tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Sync events state", method: "POST", path: "/collections/want-to-visit/events/sync", authVar: "auth_user", body: { wantToVisitIds: ["{{event_id}}"], dismissedIds: [] }, tests: testScript({ statuses: [200], requireSuccess: true }) }),
    ],
  },
  {
    name: "07 Analytics",
    item: [
      req({ name: "Analytics ingest valid", method: "POST", path: "/analytics/ingest", authVar: "auth_user", body: { events: [{ eventName: "screen_view", timestamp: "2026-03-04T12:00:00.000Z", context: { screen: "home", sessionId: "sess-docs-1" }, resource: { type: "screen", id: "home" }, meta: { source: "postman" } }] }, tests: testScript({ statuses: [200], requireSuccess: true }) }),
      req({ name: "Analytics ingest invalid event", method: "POST", path: "/analytics/ingest", authVar: "auth_user", body: { events: [{ eventName: "invalid_event_name", timestamp: "2026-03-04T12:00:00.000Z" }] }, tests: testScript({ statuses: [400] }) }),
    ],
  },
  {
    name: "08 Negative + Security",
    item: [
      req({ name: "Protected without token", method: "GET", path: "/users/me", tests: testScript({ statuses: [401] }) }),
      req({ name: "Admin endpoint with user token", method: "GET", path: "/admin/overview", authVar: "auth_user", tests: testScript({ statuses: [403] }) }),
      req({ name: "Showrooms invalid cursor", method: "GET", path: "/showrooms", query: [{ key: "cursor", value: "invalid" }], tests: testScript({ statuses: [400] }) }),
      req({ name: "Lookbooks invalid cursor", method: "GET", path: "/lookbooks", query: [{ key: "country", value: "Ukraine" }, { key: "cursor", value: "invalid" }], tests: testScript({ statuses: [400] }) }),
      req({ name: "Event not found", method: "GET", path: "/events/not-existing-id", tests: testScript({ statuses: [404] }) }),
      req({ name: "Lookbook not found", method: "GET", path: "/lookbooks/not-existing-id", tests: testScript({ statuses: [404] }) }),
      req({ name: "Notification not found", method: "PATCH", path: "/users/me/notifications/not-existing-id/read", authVar: "auth_user", tests: testScript({ statuses: [404] }) }),
      req({ name: "Showroom invalid query combination", method: "GET", path: "/showrooms", query: [{ key: "geohashPrefix", value: "u8vxn" }, { key: "q", value: "test" }], tests: testScript({ statuses: [400] }) }),
      req({ name: "Showroom suggestions empty q", method: "GET", path: "/showrooms/suggestions", query: [{ key: "q", value: "" }], tests: testScript({ statuses: [400] }) }),
    ],
  },
];

const collection = {
  info: {
    _postman_id: "2a712779-2024-4ebb-95b2-6d14f2a4d74c",
    name: "JM Showroomer - All Scenarios",
    description: "Full API regression collection for smoke, role-based access, business flows, idempotency, and negative checks.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:3005/api/v1" },
    { key: "idToken_user", value: "" },
    { key: "idToken_owner", value: "" },
    { key: "idToken_admin", value: "" },
    { key: "auth_user", value: "" },
    { key: "auth_owner", value: "" },
    { key: "auth_admin", value: "" },
    { key: "showroom_id", value: "" },
    { key: "lookbook_id", value: "" },
    { key: "event_id", value: "" },
    { key: "notification_id", value: "" },
    { key: "next_cursor", value: "" },
  ],
  item: items,
};

fs.writeFileSync(outPath, `${JSON.stringify(collection, null, 2)}\n`, "utf8");
console.log(`Generated ${outPath}`);
