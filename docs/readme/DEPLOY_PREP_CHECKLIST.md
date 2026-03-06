# Deploy Prep Checklist

## Goal

Close the backend before real QA and first production launch without mixing mock/test data with launch data.

## 1. Environment

- Set `BASE_URL=https://jm-showroomer-back.onrender.com/api/v1`
- Set real `APP_DEEPLINK_SCHEME` as app scheme, not `https://...`
- Replace placeholder store links:
  - `IOS_APP_STORE_URL`
  - `ANDROID_PLAY_STORE_URL`
- Decide whether `ENABLE_SWAGGER` stays `true` or becomes `false` for public production
- Keep `TRUST_PROXY=1`
- Recheck `ALLOWED_ORIGINS` against final Firebase hosting domains

## 2. Firebase / Firestore

- Confirm all Firestore indexes are deployed
- Confirm blocked countries (`Russia`, `Belarus`) are not present in launch content
- Confirm admin users are assigned correctly and preserved
- Remove leftover test fixtures before launch

### Admin UIDs to preserve

- `79O7MF1ofWR7QChbOeiZjB04TCf1`
- `27CuLoJwngVgTwN0aNbnVAecYz22`
- `zuiJC9FpxRS4KOAzly4GUaNl3Wv2`
- `v5LBcPFhlBMxWOkfNfJJaVSvslf2`

## 3. Data Cleanup

### Known non-launch data sources

- local/dev mock seeds
- integration test fixtures
- notification-storage fixtures (`events_notif_*`, `Notifications lookbook`)

### Safe cleanup helpers

- Dry-run notification fixtures:
  - `npm run cleanup:notifications:dry`
- Execute notification fixtures cleanup:
  - `npm run cleanup:notifications`
- Dry-run generic test cleanup:
  - `npm run test:cleanup:dry`

## 4. Content Before Launch

- Remove old mock/test showroom data
- Remove old mock/test lookbooks
- Remove old mock/test events
- Upload final client-provided lookbooks/events via script only after cleanup
- Re-run read-only production smoke after final content load

## 5. QA Before Production

- `npm run lint`
- `npm run test:unit`
- `npm run test:prod-smoke`
- Postman regression with real tokens
- Manual mobile QA on:
  - guest flow
  - owner upgrade flow
  - showroom create/edit/submit
  - favorites and want-to-visit
  - notifications
  - blocked-country cases
  - share showroom flow

## 6. Share Flow Dependencies

- Backend is ready to return share payload
- Final installed-app behavior still depends on mobile `universal links / app links`
- Do not treat share as production-complete until final app-linking setup is verified on iOS and Android

## 7. Render / Production Readiness

- Choose paid Render tier before real launch traffic
- Verify cold-start behavior is acceptable
- Verify logs and rate limits under real admin workflows
- Keep `PUSH_ENABLED=false` until real push credentials and QA are completed

## 8. Launch Gate

Production launch is ready only when all items below are true:

- environment values are final
- Firestore is cleaned from test/mock data
- admin users are preserved
- client content is loaded
- prod smoke passes
- Postman regression passes
- mobile share links are verified
