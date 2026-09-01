# BRICOLOC — Écosystème numérique

Location de machines, d'outils et de matériel (Belgique). Un **backend unique** alimente
**5 interfaces** partageant les mêmes comptes, catalogue, disponibilités et réservations :

| # | Interface | Techno | URL / lancement |
|---|-----------|--------|-----------------|
| 1 | **Site web public + réservation** | Next.js 15 | `http://localhost:3000` |
| 2 | **Application mobile iOS & Android** | Expo SDK 54 / React Native 0.81 | `npm start` dans `apps/mobile` (Expo Go) |
| 3 | **Espace client** (commun site + mobile) | — | `/compte` (web) · onglet Compte (mobile) |
| 4 | **Back-office équipe** | Next.js 15 | `http://localhost:3000/admin` |
| 5 | **Borne tactile comptoir (16")** | Next.js 15 | `http://localhost:3000/borne` |

> ⚠️ **Environnement de démonstration** : toutes les données commerciales (tarifs, coordonnées
> société, zones de livraison, TVA) sont **fictives** et **modifiables dans l'administration**.
> Le paiement est un **provider mock « mode test »** — aucun débit réel, interchangeable avec Stripe.

---

## 1. Prérequis

- **Node.js ≥ 20** (testé avec Node 24)
- npm ≥ 10
- Pour l'appli mobile : l'app **Expo Go** sur un iPhone/Android, ou un simulateur iOS / émulateur Android

## 2. Installation & démarrage rapide (API + Web)

```bash
# à la racine du projet
npm install
npm run build:shared

# base de données SQLite + données de démonstration
npm run db:reset --workspace @bricoloc/api

# lance l'API (port 4000) ET le site/admin/borne (port 3000)
npm run dev
```

Ensuite :

- Site public : <http://localhost:3000>
- Back-office : <http://localhost:3000/admin>
- Borne tactile : <http://localhost:3000/borne>
- API (santé) : <http://localhost:4000/health>

### Comptes de démonstration (mot de passe : `bricoloc`)

| Rôle | E-mail |
|------|--------|
| Client particulier | `client@bricoloc.example` |
| Client professionnel | `pro@bricoloc.example` |
| Administrateur | `admin@bricoloc.example` |
| Responsable | `responsable@bricoloc.example` |
| Comptoir | `comptoir@bricoloc.example` |
| Préparateur | `preparateur@bricoloc.example` |
| Livreur | `livreur@bricoloc.example` |
| Technicien | `technicien@bricoloc.example` |
| Comptabilité | `compta@bricoloc.example` |

Codes promo de démo : `BIENVENUE10`, `CHANTIER25`.
Carte de paiement de test : bouton **« Payer (carte success) »** ; **« Simuler un refus »** pour l'échec.

---

## 3. Application mobile iOS & Android (Expo — SDK 54)

C'est une **vraie application native** (React Native 0.81 / Expo SDK 54), pas une PWA.
SDK 54 = la version que sert **Expo Go** aujourd'hui sur les stores.

```bash
cd apps/mobile
npm install
npm start          # ouvre le Metro bundler + QR code
```

> `apps/mobile` n'est **pas** un workspace npm (Expo gère mieux ses propres
> `node_modules`). Un `.npmrc` (`legacy-peer-deps=true`) et `metro.config.js`
> isolent sa résolution de dépendances de la racine du monorepo.

### Tester sur un vrai téléphone

1. Installez **Expo Go** (App Store / Google Play) — SDK 54.
2. L'API doit être joignable depuis le téléphone : lancez l'API sur votre machine, puis indiquez
   son **IP LAN** à l'appli (le `localhost` du téléphone ≠ votre PC) :

   ```bash
   # PowerShell (exemple : votre PC est 192.168.1.20)
   $env:EXPO_PUBLIC_API_URL="http://192.168.1.20:4000"; npm start
   ```

   (ou modifiez `apps/mobile/app.json` → `expo.extra.apiUrl`)
3. Scannez le QR code affiché par Metro avec Expo Go (Android) ou l'appareil photo (iOS).
4. Le téléphone et le PC doivent être sur le **même réseau Wi-Fi**.

Si Expo Go affiche « Project is incompatible » : c'est que votre Expo Go n'est pas
en SDK 54. Mettez Expo Go à jour, ou alignez le projet : `cd apps/mobile &&
npm i expo@<sdk-de-votre-Expo-Go> && npx expo install --fix`.

### Simulateur / émulateur

```bash
npm run ios        # simulateur iOS (macOS + Xcode)
npm run android    # émulateur Android (Android Studio)
```

### Builds de test & publication

L'appli est prête pour **EAS Build** (comptes Apple / Google requis) :

```bash
npm i -g eas-cli
eas login
eas build:configure

# builds internes testables (TestFlight / APK)
eas build --profile preview --platform ios
eas build --profile preview --platform android

# builds de production pour les stores
eas build --profile production --platform all
eas submit --platform ios         # App Store Connect
eas submit --platform android      # Google Play Console
```

Identifiants applicatifs déjà définis dans `app.json` : `com.bricoloc.app` (iOS & Android).
Les notifications push utilisent le service Expo Push (activez l'envoi réel côté API avec
`EXPO_PUSH_ENABLED=true` dans `apps/api/.env`).

---

## 4. Le cycle complet (exigence §16)

Testable de bout en bout **depuis le site ou l'appli mobile** :

1. **Admin** → `/admin/produits` → *Nouveau produit* (machine) + `/admin/exemplaires` → ajout d'exemplaires
2. La machine apparaît immédiatement sur le **site**, l'**appli** et la **borne**
3. Client : ajoute **plusieurs** outils au panier (site/app/borne)
4. Il choisit ses **dates une seule fois** (bandeau global / étape unique)
5. Le système **vérifie toutes les disponibilités simultanément**
6. Retrait **Click & Collect** ou **livraison** (contrôle de zone)
7. Création de compte (ou invité) pendant le checkout
8. **Paiement mode test**
9. Réception du **numéro + QR code** (+ facture de réservation PDF)
10. **Équipe** : `/admin/comptoir` → préparation → « prêt » (notifie le client)
11. **Retrait** : scan du QR → affectation des exemplaires → checklist → signature → location active
12. Location en cours (`OUT`)
13. **Retour** : scan → heure réelle → contrôle → dommages → retard calculé
14. Contrôle de l'état du matériel (checklist + photos)
15. **Caution** libérée / partiellement retenue / capturée
16. **Facture finale** PDF disponible (espace client + admin)

Ce parcours est couvert par un **test automatisé** : `apps/api/test/cycle.test.ts`.

---

## 5. Tests & vérifications

```bash
# logique métier partagée (tarifs dégressifs, week-end, TVA, retard…)
npm run test --workspace @bricoloc/shared

# API : cycle complet E2E (boot en mémoire) + parcours B
npm run test --workspace @bricoloc/api

# tout
npm test

# typecheck
npm run typecheck

# build de production du site
npm run build --workspace @bricoloc/web

# typecheck de l'appli mobile
cd apps/mobile && npm run typecheck
```

---

## 6. Architecture

```
bricoloc/
├── packages/shared/     Types + Zod + moteur tarifaire (dégressif, week-end, TVA, retard)
├── apps/api/            API REST unique (Express + Prisma + SQLite)
│   ├── prisma/schema.prisma   Modèle de données (migrable PostgreSQL)
│   ├── prisma/seed.ts         52 produits, 104 exemplaires, équipe, promos, zones (démo)
│   └── src/
│       ├── lib/availability.ts   Moteur de disponibilité (fait foi)
│       ├── lib/quote.ts          Devis panier (prix + livraison + promo + TVA)
│       ├── lib/invoice.ts        Génération PDF (pdfkit)
│       ├── lib/notifications.ts  Notifications DB + push Expo
│       └── routes/               auth, catalog, availability, cart, checkout,
│                                 reservations, account, public, admin, ops
├── apps/web/            Next.js — (site) + /admin + /borne
└── apps/mobile/         Expo SDK 54 / React Native 0.81 — vraie appli iOS + Android
```

### Points clés

- **Les dates sont portées par le panier / la commande**, pas par ligne. Saisies une seule fois,
  mémorisées pendant toute la navigation (site, mobile, borne). L'admin peut exceptionnellement
  fixer une période par ligne (`PATCH /api/admin/reservation-items/:id/period`).
- **Disponibilité** : `capacité (exemplaires ou stock) − réservations qui chevauchent la période`.
  Statuts : disponible / quantité partielle / indisponible / *période proche* / alternatives.
- **Rôles équipe** : ADMIN, RESPONSABLE, COMPTOIR, PREPARATEUR, LIVREUR, TECHNICIEN, COMPTABILITE.
- **Contexte belge** : FR, EUR, dates `JJ/MM/AAAA`, fuseau `Europe/Brussels`, HTVA + TVAC,
  TVA configurable (21 % par défaut). Prêt pour NL / EN (`SUPPORTED_LOCALES`).

## 7. Configuration

Tous les paramètres économiques et les coordonnées société sont éditables dans
**`/admin/parametres`** (table `Setting`, valeurs par défaut dans
`packages/shared/src/constants.ts`). Aucune coordonnée officielle n'est inventée : les champs
société sont marqués *(demo)* tant qu'ils ne sont pas complétés.

Variables d'environnement API (`apps/api/.env`, créé automatiquement depuis `.env.example`) :

| Variable | Défaut | Rôle |
|----------|--------|------|
| `DATABASE_URL` | `file:./dev.db` | Base SQLite (dev) |
| `JWT_SECRET` | `dev-…` | Signature des jetons |
| `PORT` | `4000` | Port de l'API |
| `CORS_ORIGINS` | `*` | Origines autorisées |
| `EXPO_PUSH_ENABLED` | `false` | Envoi réel des push Expo |

Web (`apps/web`) : `NEXT_PUBLIC_API_URL` (défaut `http://localhost:4000`).
