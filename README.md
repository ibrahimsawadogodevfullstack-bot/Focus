# Focus — YouTube sans distraction

Application Expo (SDK 54) qui suit 17 chaînes YouTube et les lit **directement
depuis YouTube**, sans serveur intermédiaire : pas de fichiers mp4 chez nous,
pas d'API maison.

## Comment ça marche

- **Liste des vidéos** : flux Atom publics
  (`https://www.youtube.com/feeds/videos.xml?channel_id=UC...`), sans clé API et
  sans quota. 15 dernières vidéos par chaîne, 17 chaînes → 240 vidéos.
- **Lecture** : lecteur YouTube officiel (IFrame API) dans une `WebView`, donc
  dans l'application. Aucune extraction de flux, aucun téléchargement.
- **Cache** : le flux fusionné est gardé dans `AsyncStorage` (TTL 10 min) pour
  un démarrage instantané et un affichage hors ligne.
- **Mode focus** : la WebView refuse toute navigation hors du lecteur
  (`onShouldStartLoadWithRequest` + `setSupportMultipleWindows={false}`), les
  vidéos liées sont limitées à la chaîne (`rel=0`), et la fin de vidéo enchaîne
  automatiquement sans écran de recommandations. Sortir vers YouTube demande une
  confirmation explicite.

## Limites assumées

- Les vidéos dont l'intégration est désactivée (ou âge/region-restreintes) ne
  peuvent pas être lues dans l'app : un message propose de les ouvrir dans
  YouTube en connaissance de cause.
- On ne masque ni le logo YouTube, ni les publicités, ni les contrôles du
  lecteur : c'est interdit par les conditions d'utilisation de l'embed.
- Le flux RSS ne donne ni durée ni distinction Shorts/vidéos longues. Pour ça il
  faudrait passer à la YouTube Data API v3 avec une clé restreinte (et donc un
  dev build, une clé ne pouvant pas être verrouillée depuis Expo Go).

## Structure

```
App.js                    navigation (flux ↔ lecteur) + chargement du flux
constants/channels.js     les 17 channel IDs
constants/theme.js        palette et espacements
services/feed.js          fetch RSS, fusion, tri, cache
services/rssParser.js     analyse Atom (sans dépendance XML)
services/storage.js       AsyncStorage : cache du flux, vidéos déjà vues
services/playerHtml.js    document du lecteur + API window.__yt
components/YoutubePlayer  WebView verrouillée + commandes impératives
components/VideoRow       ligne de vidéo
components/ChannelChips   filtre par chaîne
screens/FeedScreen        flux + filtres + pull-to-refresh
screens/PlayerScreen      lecture, contrôles, à suivre, sortie confirmée
```

## Lancer

```sh
npm start          # puis scanner le QR avec Expo Go
npm run android    # ou ouvre un émulateur/appareil Android
```

## Vérifications

- `npx expo export --platform android` : le bundle passe.
- Parser testé sur les 17 flux réels : 17/17 chaînes, 240 vidéos, ~1,2 s.
