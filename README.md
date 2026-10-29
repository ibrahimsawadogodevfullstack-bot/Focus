# Focus — YouTube sans distraction

Application Expo (SDK 54) qui rassemble les vidéos des chaînes que tu choisis et
les lit **dans un lecteur verrouillé**, sans recommandations : l'accueil ne
montre que tes chaînes, présentées comme sur YouTube. Tout passe par YouTube :
pas de serveur intermédiaire, pas de clé API.

## Fonctionnalités

- **Flux fusionné** : flux Atom publics
  (`https://www.youtube.com/feeds/videos.xml?channel_id=UC...`), 15 dernières
  vidéos par chaîne, tri par date. 17 chaînes fournies au premier lancement.
- **Bibliothèque personnelle** : ajout d'une chaîne par
  - identifiant brut `UC…` (24 caractères),
  - `@handle`,
  - URL de chaîne (`/channel/UC…`, `/c/…`, `/user/…`, `/@handle`, y compris les
    onglets `/videos`, `/about`…),
  - URL de vidéo (`youtu.be/…`, `watch?v=…`), résolue via oEmbed.

  Le titre officiel est récupéré depuis le flux RSS, ce qui valide la chaîne au
  passage. Les chaînes ajoutées, comme celles retirées, sont persistées.
- **Hors ligne** : comme dans YouTube, le menu « … » d'une vidéo propose
  « Télécharger » : sa fiche et sa miniature sont conservées et apparaissent
  dans l'onglet Hors ligne (avec suppression possible). La carte affiche la
  progression en pourcentage pendant l'enregistrement, puis un badge
  « Téléchargée ». L'onglet permet aussi de
  garder d'un coup les titres, chaînes et miniatures de tout le flux. Le fichier
  vidéo, lui, n'est pas enregistré (interdit par les CGU du lecteur) : la liste
  reste consultable, la lecture demande une connexion.
- **Accueil façon YouTube** : barre du haut avec le logo, la recherche (titre ou
  chaîne, insensible aux accents) et un accès à la bibliothèque ; rangée de puces
  « Tous » + catégories ; grandes cartes 16:9 avec avatar, titre, chaîne et date.
- **Catégories** : regroupements nommés de plusieurs chaînes (« Maths »,
  « Anglais », « Tech »…). Une catégorie devient un filtre du flux et peut être
  modifiée ou supprimée à tout moment ; retirer une chaîne la retire aussi des
  catégories.
- **Lecture** : page `youtube.com/embed/…` dans une `WebView`, avec un
  `Referer` neutre (YouTube refuse la lecture avec un referer YouTube : erreurs
  152/153). Les commandes de l'interface (lecture, ±10 s, progression) pilotent
  le lecteur via un pont JavaScript injecté. La navigation hors du lecteur est
  bloquée, la fin de vidéo enchaîne sur la suivante, et toute sortie vers
  YouTube demande une confirmation.
- **Cache** : flux gardé dans `AsyncStorage` (TTL 10 min, invalidé quand la
  liste des chaînes change), affichage hors ligne, titres appris puis stockés.
- **Vidéos déjà vues** : pastille « nouveau » sur les vidéos non encore ouvertes.
- **Suivi et statistiques** : onglet Stats « Ma semaine » (jours actifs, temps
  effectif, vidéos finies, objectif hebdomadaire) puis, par catégorie, le temps
  de la semaine, la progression et un état (« À l'aise », « 2 à revoir »,
  « Négligé »). Le détail d'une catégorie montre le graphique jour par jour,
  l'avancement et les vidéos suivies. Dans le lecteur, une auto-évaluation
  (« Pas vraiment / À peu près / Bien compris ») et la détection des passages
  revus alimentent la synthèse.
- **Gestion des chaînes** : ajout par identifiant, handle ou URL ; suppression
  depuis l'onglet Chaînes ou directement depuis l'accueil (menu « … »), avec
  confirmation dans les deux cas.

## Limites assumées

- Les vidéos dont l'intégration est désactivée (ou âge/région restreintes) ne
  peuvent pas être lues dans l'app : un message propose de les ouvrir dans
  YouTube en connaissance de cause.
- On ne masque ni le logo YouTube, ni les publicités, ni les contrôles du
  lecteur : c'est interdit par les conditions d'utilisation de l'embed.
- Le flux RSS ne donne ni durée ni distinction Shorts/vidéos longues.
- Les statistiques sont locales (AsyncStorage) : temps réellement joué,
  vidéos terminées quand elles atteignent la fin, passages revus = retours en
  arrière de plus de 3 secondes. Rien n'est envoyé sur un serveur.
- L'ajout par `@handle` dépend du HTML public de YouTube ; l'identifiant `UC…`
  reste la méthode la plus fiable.

## Structure

```
App.js                     état (bibliothèque, catégories, route) + chargement
constants/channels.js      chaînes par défaut et leurs titres
constants/theme.js         jetons de design (couleurs, espacements, rayons)
services/feedUrl.js        URL du flux Atom d'une chaîne
services/feed.js           fetch RSS, fusion, tri, cache par périmètre
services/rssParser.js      analyse Atom (sans dépendance XML)
services/storage.js        AsyncStorage : flux, vu, chaînes, catégories
services/offline.js        instantané hors ligne + préchauffage des miniatures
services/tracking.js       temps vu, progression, révisions, auto-évaluation
services/downloads.js      téléchargements par vidéo (fiche + miniature)
services/stats.js          agrégats semaine/catégorie, états, synthèse
services/channelResolver.js résolution identifiant / @handle / URL / vidéo
services/channelCandidates.js extraction des UC… depuis une page de chaîne
services/net.js            fetch direct (mobile) ou via proxy (web)
services/playerEmbed.js    URL d'embed + pont de contrôle injecté
components/YoutubePlayer   WebView verrouillée + commandes impératives
components/YoutubePlayer.web  iframe YouTube pilotée par l'IFrame API (web)
components/FocusMark       logo « focus »
components/AppBar          logo, recherche, accès bibliothèque
components/ConfirmSheet    confirmation en feuille basse (web + mobile)
components/ActionSheet     menu « … » (télécharger, retirer la chaîne)
components/VideoCard       carte vidéo façon YouTube
components/CategoryChips   puces « Tous » + catégories
screens/FeedScreen         accueil, puces, recherche, pull-to-refresh
screens/ChannelsScreen     bibliothèque de chaînes (ajout/retrait)
screens/OfflineScreen      téléchargements, cache du flux, progression
screens/StatsScreen        « Ma semaine », objectif, par catégorie
screens/CategoryStatsScreen détail d'une catégorie (graphique, vidéos)
screens/CategoriesScreen   liste des catégories
screens/CategoryEditor     création/édition d'une catégorie
screens/PlayerScreen       flux vertical paginé, contrôles, sortie bloquée
metro.config.js            proxy YouTube pour l'aperçu web (dev uniquement)
```

## Lancer

```sh
npm install
npm start          # Expo Go, ou
npm run android    # appareil/émulateur connecté
```

## Aperçu web (localhost)

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

- `npx expo export --platform android` : bundle Metro OK.
- Résolveur de chaînes testé sur YouTube réel : identifiant, `/channel/UC…`,
  `@handle`, `/@handle/videos`, `/c/…`, `/user/…`, `youtu.be/…` et
  `watch?v=…` → identifiant + titre corrects ; entrées invalides → message
  explicite.
- Interface vérifiée en rendu réel (react-native-web + Chrome) : flux, ajout
  d'une chaîne par `@handle`, création d'une catégorie, filtrage du flux,
  écran de lecture.
- Lecteur vérifié dans Chrome/Blink : `ready` (durée), `play`, `seekTo(60)`,
  pause, progression, détection d'erreur d'intégration.
