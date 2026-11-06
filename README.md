# Focus: YouTube Sans Distraction

One app to watch YouTube your way—vertical, distraction-free, and offline-ready.

> **See a feature you like?** Understand how it works, from the UI to the offline cache.

---

[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo)](https://docs.expo.dev/versions/v54.0.0/)
[![platform](https://img.shields.io/badge/platform-react--native-blue)](https://reactnative.dev/)
[![GitHub](https://img.shields.io/badge/source-GitHub-181717?logo=github)](https://github.com/ibrahimsawadogodevfullstack-bot/Focus)

---

## ⭐ Features

- **Vertical YouTube Experience**: Mobile-first, portrait-optimized layout.
- **Offline Mode**: Download videos and keep your feed cached for true offline viewing.
- **No Recommendations**: Only your chosen channels, no distractions.
- **Categories & Stats**: Group channels, track your viewing, and set goals.
- **Full i18n**: French and English, system language detection.
- **Privacy First**: No server, no tracking, all data stays on your device.

---

---

## Getting Started

```sh
npm install
npm run android # or npm start for Expo Go
```

---

## Requirements

- Expo SDK 54+
- React Native 0.81+
- Node.js 18+

---

## License

MIT


```sh
npm run web        # http://localhost:8081
```

Le navigateur interdit les appels vers `youtube.com` (CORS), ce qui n'arrive
jamais sur mobile. Pour pouvoir tester le flux, l'ajout de chaînes et la
lecture depuis un navigateur, `metro.config.js` expose un proxy de développement
(`/__youtube`) qui relaie les flux RSS, les pages de chaîne, oEmbed et l'API du
lecteur. `services/net.js` bascule automatiquement dessus quand
`Platform.OS === 'web'` ; sur Android/iOS, les requêtes partent directement chez
YouTube. Sur le web, le lecteur est une vraie iframe YouTube pilotée par
l'IFrame API (`components/YoutubePlayer.web.js`).

Ce proxy et le lecteur web ne font pas partie du build mobile.

## Construire l'APK

```sh
npx expo prebuild -p android --clean
echo "sdk.dir=$HOME/Android/sdk" > android/local.properties
cd android && ./gradlew app:assembleRelease \
  -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
```

L'APK est produit dans `android/app/build/outputs/apk/release/`.

## Vérifications

- `npm test` : tests unitaires des formats, RSS, miniatures et paramètres du
  lecteur.
- `npx eslint App.js screens components services i18n.js` : lint du code actif.
- `npx expo export --platform android` : génération du bundle Android.
- Aucun appareil Android physique n'était connecté ; les mesures matérielles
  restent à faire (voir [PERF.md](./PERF.md)).
