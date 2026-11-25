# Wesal mobile app

The customer app for Wesal (docs/features/customer-mobile-app), built with Expo
and React Native (ADR-033). It calls the same `/api/v1` operations as the
website; no booking rule lives here.

## What is here

- `App.tsx` — the tab shell (Home, Calendar, My booking), language switch and the
  small route state. Arabic is the default; English is one tap away.
- `src/api.ts` — the API client: content, occasions, availability, verification,
  holds, the private booking page, proof upload, staff login, device
  registration and the review queue.
- `src/screens/` — Home, Calendar, Booking form, Booking page (with countdown and
  screenshot upload) and the staff screen (login, review queue, push
  registration).
- `src/i18n.ts`, `src/theme.ts` — bilingual strings and the website's tokens.
- `src/storage.ts` — booking tokens and the staff session on the device
  (AsyncStorage and SecureStore).

## Running it

```bash
cd mobile
npm install
npx expo install --fix
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000 npx expo start
```

The API must be reachable from the phone; `localhost` on the phone is the phone
itself. Set `EXPO_PUBLIC_API_URL` to the machine's LAN address in development and
to the production origin in builds. The fallback in `app.json` is a placeholder.

## Tests

```bash
cd mobile
npm test           # Jest + jest-expo, one run
npm run test:watch
npm run coverage   # gated at 80% lines / 70% branches
```

`src/api.ts`, `src/dates.ts`, the shared components and every screen have tests.
`jest.setup.ts` supplies the Expo native mocks (SecureStore, notifications,
image picker, localization, safe areas) and a fixed API origin; the app's
network calls are mocked at the `fetch` boundary.

## Store builds

`eas.json` has development, preview and production profiles, and the app ids are
`com.wesal.app`. Producing Android and iOS store builds needs:

- a Google Play developer account and an upload key,
- an Apple Developer account, an App Store Connect app and signing credentials,
- `eas init` with the real Expo project id (replace the placeholder in
  `app.json` → `extra.eas.projectId`) and `EXPO_ACCESS_TOKEN` for push.

Then:

```bash
npx eas build --platform android --profile production
npx eas build --platform ios --profile production
npx eas submit --platform android
npx eas submit --platform ios
```

These credentials do not exist in the repository, so the store items in the
roadmap remain open until they are supplied.

## Push

Staff who sign in on the app register the device with
`POST /api/v1/staff/devices`; logout removes it. Push goes through Expo and falls
back to WhatsApp (ADR-034). Without a project id the app says the device could
not be registered rather than pretending it will receive alerts.
