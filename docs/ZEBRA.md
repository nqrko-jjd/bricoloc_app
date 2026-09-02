# Terminal Zebra TC51 — mise en service

L'espace équipe est maintenant une **appli native** (le « mode équipe » de
l'appli mobile), plus une page web. Sur le Zebra :

- **En test** : installer **Expo Go** (Play Store), lancer `npx expo start` sur
  le PC, scanner le QR depuis Expo Go (même Wi-Fi).
- **En vrai** : APK dédié construit avec `expo.extra.teamMode = true` (voir
  `apps/mobile/lib/config.ts`) → l'appli démarre directement sur l'espace équipe,
  le parcours client est masqué. Build via EAS (Lot 7).

## Scanner : le lecteur physique, pas la caméra

Le TC51 a un **lecteur code-barres laser intégré** (gâchettes sur les côtés).
**Aucun besoin de caméra ni de HTTPS.** Le lecteur se comporte comme un clavier :
il « tape » le code lu dans le champ de scan de l'appli, qui est **toujours
actif**. L'appli valide automatiquement dès la fin de la rafale de caractères —
que DataWedge envoie une touche Entrée finale ou non.

La caméra (bouton 📷) ne sert que sur un téléphone / tablette **sans** lecteur
physique. Sur le Zebra : **toujours la gâchette**.

### Configuration DataWedge (une seule fois)

1. Ouvrir l'appli **DataWedge** sur le Zebra.
2. Menu **⋮ → Settings** : vérifier que **« DataWedge enabled »** est coché.
   *(si c'est décoché, aucune gâchette ne fait rien — c'est la cause n°1)*
3. Revenir à la liste des profils → ouvrir **Profile0 (default)**.
   Ce profil s'applique à toutes les applis non réclamées par un autre profil
   (donc Expo Go **et** l'APK Bricoloc).
4. Dans Profile0 :
   - **Profile enabled** : coché
   - **Barcode input** : Enabled
   - **Keystroke output** : Enabled
   - **Keystroke output → Basic data formatting → Send ENTER key** : coché
     *(recommandé — l'appli marche aussi sans, mais c'est plus net)*
5. Fermer DataWedge. Ouvrir l'appli Bricoloc → un écran avec un champ de scan
   (Comptoir, Stock, Réparations, Inventaire) → viser un code → **presser la
   gâchette**. Le code s'inscrit et l'action se déclenche.

### Si la gâchette ne fait toujours rien

- La gâchette n'allume même pas le viseur rouge → DataWedge désactivé (étape 2),
  ou le **Scanner** est désactivé dans Profile0 (« Barcode input » → Enabled),
  ou une autre appli scanner tourne en arrière-plan (la fermer).
- Le viseur s'allume, ça bippe, mais rien dans l'appli → « Keystroke output »
  n'est pas activé, ou est réglé sur « Intent output ». Repasser en Keystroke.
- Test rapide : ouvrir l'appli **Notes / un navigateur**, toucher un champ
  texte, scanner un code — s'il s'écrit, DataWedge est OK et le souci est
  ailleurs ; s'il ne s'écrit pas, c'est bien la config DataWedge.

## Ce qu'on peut faire au dépôt avec le Zebra

Écran d'accueil = 4 grosses touches :

| Touche | Usage |
|---|---|
| **Comptoir** | Retrait / retour client, guidé : scan de la résa → encaissement / caution → scan de chaque machine → contrôle + photos → signature client à l'écran → sortie. Retour en miroir (contrôle, dommages, caution, clôture + facture). |
| **Stock** | Machines (avec photo, emplacement 📍) : dispo / total. Scan ou touche → exemplaires → changement d'état. Onglet Consommables. |
| **Réparations** | Exemplaires « à réparer » / « en réparation » / « entretien à prévoir ». Scan ou touche → remettre en service / réparation / endommagé / hors service. |
| **Inventaire** | Scan des exemplaires « disponibles » un par un. Décompte par machine + liste des manquants à la fin. |

## Caméra lente

Sur le TC51 (matériel 2016) le scan par **caméra** est lent — c'est normal,
utiliser la gâchette. Sur un smartphone récent la caméra est fluide.
