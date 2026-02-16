# DEV Test & Release Runbook

---

## 1) Test environment (`NODE_ENV=test`)

```bash
NODE_ENV=test ./src/test/test_smoke.sh
# npm run test:smoke

NODE_ENV=test ./src/test/test_showrooms.sh
# npm run test:showrooms

NODE_ENV=test ./src/test/test_showrooms_favorites.sh
# npm run test:showrooms-favorites

NODE_ENV=test ./src/test/test_admin_and_collections.sh
# npm run test:admin

NODE_ENV=test ./src/test/test_geo_paging_checks.sh
# npm run test:geo

NODE_ENV=test ./src/test/test_suggestions_and_counters.sh
# npm run test:suggestions

NODE_ENV=test ./src/test/test_events_mvp1.sh
# npm run test:events

NODE_ENV=test ./src/test/test_events_guest_sync.sh
# npm run test:events-guest-sync

NODE_ENV=test ./src/test/test_lookbooks.sh
# npm run test:lookbooks
```
---

За потреби медіа-тесту:
```bash
# Terminal 1: Firestore emulator
firebase emulators:start --only firestore

# Terminal 2: app with emulator host
export FIRESTORE_EMULATOR_HOST=localhost:8085
npm run dev

# Terminal 3: media test
export FIRESTORE_EMULATOR_HOST=localhost:8085
NODE_ENV=test ./src/test/test_media.sh
# npm run test:media
```

---

## 2) Production read-only check
```bash
NODE_ENV=prod ./src/test/test_prod_readonly.sh
```

---

## 3) Before commit (mandatory)
```bash
bash -lc 'shopt -s nullglob; shellcheck src/test/*.sh scripts/*.sh && echo "shellcheck OK"'
npm run test:unit -- --watchman=false
npx @redocly/cli lint docs/openapi.yaml
```

---

## 4) Local docs check
```bash
npm run dev
```
Відкрити:
- http://localhost:3005/docs

---

## 5) Firebase / Firestore block

### Hosting deploy
```bash
firebase deploy --only hosting --project jm-showroom
```

---

### Firestore indexes deploy
```bash
firebase deploy --only firestore:indexes --project jm-showroom
```

---

### Firestore indexes check (gcloud)
```bash
gcloud auth login
gcloud config set project jm-showroom
gcloud firestore indexes composite list --project=jm-showroom
gcloud firestore indexes fields list --project=jm-showroom
```

---

### (Optional) Migration helper
```bash
npm run firebase:migration -- --project <new-project-id> --env-file .env.prod
npm run firebase:migration -- --project <new-project-id> --write-firebaserc --deploy-indexes
```
