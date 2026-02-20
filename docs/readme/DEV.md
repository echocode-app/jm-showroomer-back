# DEV

## Priority 1 — before every commit
```bash
npm run lint
npm run test:unit
npm run test:smoke
npm run test:push
```

## Priority 2 — before PR
```bash
npm run test:flows
npm run test:notifications
npm run test:full
```

## Priority 3 — extended / optional
```bash
NODE_ENV=test ./src/test/integrations/test_geo_paging.sh
NODE_ENV=test ./src/test/integrations/test_guest_sync.sh
NODE_ENV=test ./src/test/integrations/test_media.sh
NODE_ENV=test ./src/test/integrations/test_extended.sh
```

## Priority 4 — production only
```bash
npm run test:prod-smoke
```

## Cleanup
```bash
npm run test:cleanup:dry
npm run test:cleanup
```

## Pre-commit checklist
- `npm run lint`
- `npm run test:unit`
- `npm run test:smoke`
- `npm run test:push`
- if API changed: `npm run test:notifications`

## Validation commands
```bash
bash -lc 'shopt -s nullglob; shellcheck src/test/*.sh src/test/core/*.sh src/test/flows/*.sh src/test/integrations/*.sh src/test/prod/*.sh src/test/lib/*.sh src/test/lib/helpers/*.sh scripts/*.sh && echo "shellcheck OK"'
npm run lint
npm run test:unit
npm run test:full
```

## Firebase block
```bash
firebase login
firebase use <project-id>
firebase deploy --only firestore:indexes --project <project-id>
firebase deploy --only hosting --project <project-id>

# verify indexes
gcloud auth login
gcloud config set project <project-id>
gcloud firestore indexes composite list --project=<project-id>
gcloud firestore indexes fields list --project=<project-id>

# migration helper
npm run firebase:migration -- --project <new-project-id> --env-file .env.prod
```

## Environment flags reference
- `NODE_ENV`: `dev` | `test` | `prod`
- `PORT`: server port
- `BASE_URL`: base API URL for bash tests
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`
- `PUSH_ENABLED`: `true` to enable push in non-test env, default `false`
- `TEST_USER_TOKEN`
- `TEST_ADMIN_TOKEN`
- `TEST_OWNER_TOKEN_2`
