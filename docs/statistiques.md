# Statistiques de visionnage — refonte de l’onglet « Vous »

## Résumé

L’onglet « Vous » devient une page de profil local avec un aperçu des
statistiques de visionnage. Trois pages secondaires ont été ajoutées :
« Statistiques », « Paramètres des statistiques » et « Paramètres ». L’onglet
« Stats » a été retiré de la barre du bas.

Toutes les mesures restent sur l’appareil. Aucune requête réseau n’est faite
pour les statistiques et aucun système de compte n’a été introduit.

## Ce qui a changé

| Avant | Après |
| --- | --- |
| Onglet « Stats » dans la barre du bas | Onglet retiré ; les statistiques vivent dans « Vous » |
| Page « Vous » = réglages uniquement | Page « Vous » = profil + consommation + objectif + habitudes + engagement + en ligne/hors ligne |
| Aucun détail | Page « Statistiques » : tous les jours, toutes les catégories, top 5 chaînes, moments, sessions, série de Shorts |
| Aucun réglage de stats | Page « Paramètres des statistiques » : objectif du jour, période par défaut, résumé, affichage, réinitialisation |
| Réglages dispersés | Page « Paramètres » : Général / Lecture / Concentration / Données et stockage / Statistiques / Compte / À propos |

## Comment les chiffres sont calculés

Le temps mesuré est le **temps réel passé à regarder**, avec l’application au
premier plan. Il est découpé aux frontières d’heure et de minuit, donc
« aujourd’hui » et « le soir » restent justes même après une lecture longue.

| Notion | Règle |
| --- | --- |
| Vidéo regardée | au moins 3 secondes de lecture réelle |
| Vidéo terminée | au moins 90 % du contenu vu par petits pas (un saut dans la barre ne valide rien) |
| Quittée tôt | moins de 20 % du contenu vu à la fin de la lecture |
| Relecture | même vidéo commencée au moins deux fois |
| Session | lectures séparées par moins de 30 minutes |
| Catégorie | première catégorie de la liste qui contient la chaîne ; sinon « Sans catégorie » |
| Catégorie supprimée | son ancien nom est conservé et un badge « supprimée » l’accompagne |
| Série de Shorts | Shorts consécutifs réellement commencés ; une vidéo longue remet le compteur à zéro |
| Période | jours locaux complets : aujourd’hui, 7 jours ou 30 jours, aujourd’hui inclus |
| Comparaison | avec la période précédente de même durée ; rien n’est affiché sans données précédentes |

Le résumé automatique fait au plus trois phrases, seulement à partir de trois
jours d’activité, et peut être masqué dans les paramètres. Aucun classement,
aucune note, aucune notification, aucun blocage.

## Où vivent les données

- Clé locale : `focus.viewing.v1.<profil>` (profil actuel : `local`).
- Les structures sont indexées par `profileId` : plusieurs profils peuvent
  cohabiter, même si l’application n’expose qu’un profil.
- Migration unique de `focus.tracking.v1` : seuls le temps et les chaînes sont
  repris. Ces jours sont marqués comme estimés et signalés dans les pages.
- Écriture différée de 3 secondes pendant la lecture, écriture immédiate quand
  l’application passe en arrière-plan.
- Toute erreur de suivi est journalisée discrètement : elle ne remonte jamais
  à l’écran et n’arrête jamais la lecture.
- La réinitialisation efface le temps, les vidéos, les sessions et les
  habitudes du profil courant. Les chaînes, catégories et réglages restent.

## Paramètres des statistiques

| Réglage | Valeur par défaut | Effet réel |
| --- | --- | --- |
| Objectif du jour | aucun | Barre de progression neutre sur « Vous » |
| Période par défaut | 7 jours | Période sélectionnée à l’ouverture de « Vous » et du détail |
| Afficher le résumé | oui | Masque les phrases sous les chiffres |
| Afficher les statistiques | oui | Si désactivé, « Vous » ne montre que le profil |
| Réinitialiser | — | Confirmation explicite, limitée au profil courant |

## Captures

Dossier : `docs/stats-screenshots/`.

Les captures ont été prises sur Expo Web avec un **jeu de données de
démonstration** injecté dans le stockage local pour remplir tous les blocs.
Elles ne représentent pas un historique réel.

### 4 pages × clair/sombre × FR/EN

- `fr-light-1-you.png`, `fr-light-2-detail.png`, `fr-light-3-settings.png`, `fr-light-4-stats-settings.png`
- `fr-dark-1-you.png`, `fr-dark-2-detail.png`, `fr-dark-3-settings.png`, `fr-dark-4-stats-settings.png`
- `en-light-1-you.png`, `en-light-2-detail.png`, `en-light-3-settings.png`, `en-light-4-stats-settings.png`
- `en-dark-1-you.png`, `en-dark-2-detail.png`, `en-dark-3-settings.png`, `en-dark-4-stats-settings.png`

### Grand écran (1280 × 1000)

- `fr-light-desktop-1-you.png` … `fr-light-desktop-4-stats-settings.png`
- `en-dark-desktop-1-you.png` … `en-dark-desktop-4-stats-settings.png`

## Vérifications effectuées

- `npx tsc --noEmit` : aucune erreur.
- `npm test` : 81 tests, 81 réussis (dont 7 nouveaux tests sur les périodes, les
  parts, les comparaisons, le formatage et le découpage à minuit).
- `npx eslint` sur tous les fichiers ajoutés ou modifiés : aucun avertissement.
  Le projet conserve une erreur de parsing préexistante dans
  `tests/i18n.test.js` et quelques avertissements dans des fichiers non touchés.
- `npx expo export --platform android` : bundle Android généré.
- Parcours automatisé sur Expo Web (Playwright), tous réussis :
  - ouverture du détail directement sur le bloc touché ;
  - changement de période ;
  - objectif personnalisé ;
  - masquage des statistiques ;
  - réinitialisation avec confirmation ;
  - changement immédiat de langue et de thème ;
  - persistance de la langue et du thème après rechargement.

## Limites et choix assumés

1. **Aucun compte dans l’application.** Il n’existe ni nom, ni identifiant, ni
   connexion. Le profil est donc local et unique. Les statistiques sont
   techniquement séparées par `profileId`, mais aucun écran ne permet de
   changer de compte, de se déconnecter ou de supprimer un compte. La section
   « Compte » l’explique au lieu d’afficher des boutons inutiles.
2. **Qualité vidéo non pilotable.** L’embed YouTube ne permet pas de choisir
   une qualité par défaut depuis l’application. Le réglage n’a donc pas été
   ajouté, et l’économie de données est signalée comme agissant sur les
   miniatures et les avatars, pas sur la qualité vidéo.
3. **Captures web uniquement.** Aucun appareil ni émulateur Android n’était
   disponible. Le rendu natif et la lecture réelle n’ont donc pas été
   photographiés ; seul le bundle Android a été vérifié.
4. **Données de démonstration.** Les valeurs visibles dans les captures
   proviennent d’un jeu de test local, pas d’un historique réel.
5. **Anciennes statistiques estimées.** L’import ne conserve que le temps et
   les chaînes. Il ne peut pas reconstituer les vidéos terminées, les sessions
   ni les moments de la journée ; les jours concernés sont signalés.
6. **Téléchargements hors ligne.** Une vidéo téléchargée est comptée comme
   vidéo longue (le format Short n’est pas enregistré dans les téléchargements)
   et la chaîne est identifiée par son nom, pas par son identifiant YouTube.
   Une même chaîne peut donc apparaître en deux lignes si elle est regardée en
   ligne et hors ligne.
7. **Vidage du cache sur le Web.** Le bouton est désactivé et expliqué :
   `expo-image` ne permet pas de vider son cache sur le Web.
8. **Aide et conditions d’utilisation.** Aucune page d’aide ou de conditions
   n’existe dans l’application ; la section « À propos et aide » n’affiche que
   la version. Aucun lien factice n’a été ajouté.
9. **Ancien code conservé.** `screens/StatsScreen.js`,
   `screens/CategoryStatsScreen.js` et `services/stats.js` ne sont plus
   accessibles mais restent dans le dépôt pour ne pas modifier les autres
   onglets. Ils pourront être supprimés dans un changement dédié.
10. **Mesure du temps.** Seule la lecture active avec l’application au premier
    plan est comptée. L’écran verrouillé ou l’application en arrière-plan ne
    comptent pas, ce qui évite de gonfler les chiffres.

## Fichiers principaux

- `screens/YouScreen.tsx`, `screens/StatsDetailScreen.tsx`,
  `screens/StatsSettingsScreen.tsx`, `screens/SettingsScreen.tsx`
- `services/viewingStats.ts` (stockage et mesure), `services/viewingSummary.ts`
  (agrégats purs et formatage)
- `src/domain/viewing.ts`, `src/domain/categories.ts`,
  `src/shared/utils/timeSlices.ts`
- `src/shared/ui/stats/StatsPrimitives.tsx`,
  `src/shared/ui/stats/sentences.ts`, `src/shared/ui/PageHeader.tsx`
- `screens/PlayerScreen.js`, `screens/OfflinePlayerScreen.tsx` (instrumentation)
- `App.js` (navigation, initialisation, écriture en arrière-plan)
- `locales/fr.json`, `locales/en.json`, `i18n.js`
- `metro.config.js` (résolution du module WebAssembly d’`expo-sqlite` pour
  l’aperçu Web)
