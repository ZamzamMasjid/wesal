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

`npx expo start` runs the JS bundle inside Expo Go. That is enough for the
customer screens, but Expo Go cannot receive remote push, so use a development
build for the staff flows.

## Development build

The native shell is built once by EAS (`eas.json` → `development` profile), then
`expo start` serves code into it. Rebuild only when native dependencies,
`app.json` plugins or the app id change.

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init      # writes the real project id into app.json
npm run build:android:dev    # APK download link when the build finishes
```

Install the APK on an Android phone, then start Metro against it:

```bash
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000 npm run start:dev
```

`EXPO_PUBLIC_API_URL` is inlined into the bundle, not read at runtime, so it must
be set both in the terminal running Metro and when producing store builds. The
`preview` profile (`npm run build:android:preview`) makes a plain installable
APK without the dev menu.

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
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform android
npx eas-cli@latest submit --platform ios
```

These credentials do not exist in the repository, so the store items in the
roadmap remain open until they are supplied.

## Push

Staff who sign in on the app register the device with
`POST /api/v1/staff/devices`; logout removes it. Push goes through Expo and falls
back to WhatsApp (ADR-034). Without a project id the app says the device could
not be registered rather than pretending it will receive alerts.
