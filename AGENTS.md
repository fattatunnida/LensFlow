# LensFlow

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Versioned documentation

Before writing code that touches Expo, EAS, or React Native APIs, read the major version of expo in package.json and fetch https://docs.expo.dev/versions/v<major>.0.0/. For other Expo questions, read https://docs.expo.dev/llms.txt and follow its links. Do not rely on remembered APIs.

## Commands

Use npx expo install for SDK-compatible dependency installation. Use bunx instead of npx only when bun.lock is present. Run npm run lint and npm run typecheck before declaring work done.

## Navigation

Use Expo Router. Routes belong in src/app/; components, hooks and utilities belong outside it. Import Link, router and useLocalSearchParams from expo-router.

## Native projects

Never create or edit generated ios/ or android/ directories by hand. Configure native behavior through app.json and config plugins. Libraries with native code outside Expo Go require a development build. Prefer recommended Expo modules. Use EAS for cloud builds, signing, submission and updates.
