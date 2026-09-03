# API partenaire — Parc partagé Bricoloc ↔ JJD

Bricoloc est la **source de vérité** du parc physique (chaque exemplaire, son état,
où il se trouve). Le CRM JJD pilote via cette API : il synchronise ses chantiers,
sort/rentre les outils, décompte les consommables, et affiche « où est quoi ».

- **Base URL** : `https://new.bricoloc.be/bricoloc-api/api/partner`
- **Auth** : en-tête `x-api-key: <PARTNER_API_KEY>` sur **toutes** les requêtes.
- **Format** : JSON. Erreurs = `{ "error": { "code": "...", "message": "..." } }`.
- Cette API ne renvoie **jamais** de données client / réservation / prix Bricoloc.

Test rapide : `GET /health` → `{ "ok": true, "service": "bricoloc-parc" }`.

---

## 1. Chantiers

### `POST /chantiers` — synchroniser (upsert par `externalRef`)

Corps : un objet ou un tableau.

```json
{ "externalRef": "CH-2026-014", "name": "Rénovation rue Haute 12", "client": "SPRL Martin", "address": "Rue Haute 12, 1000 Bruxelles", "active": true }
```

`externalRef` = l'id du chantier **dans le CRM JJD**. C'est la clé : renvoyer le même
`externalRef` m-> met à jour. `active: false` -> archivé (refusé pour de nouvelles sorties).

### `GET /chantiers` — liste des chantiers actifs

### `GET /chantiers/:externalRef` — fiche chantier

```json
{
  "chantier": { "id": "...", "externalRef": "CH-2026-014", "name": "..." },
  "tools":    [ { "loanId": "...", "assetTag": "BRL-0142", "product": "Ponceuse girafe", "since": "2026-09-03T08:12:00Z", "takenBy": "Kévin" } ],
  "consumption": [ { "product": "Disque abrasif 225mm", "quantity": 6, "at": "...", "takenBy": "Kévin" } ]
}
```

---

## 2. Stock

### `GET /stock?q=<recherche>` — état du parc

```json
{ "products": [ {
  "id": "...", "name": "Ponceuse girafe", "kind": "MACHINE", "category": "Ponçage",
  "total": 3, "available": 1, "onSite": 1, "rented": 1,
  "units": [
    { "assetTag": "BRL-0142", "state": "ON_SITE",   "storageLocation": null,    "chantier": { "name": "Rue Haute 12", "ref": "CH-2026-014", "since": "..." } },
    { "assetTag": "BRL-0143", "state": "AVAILABLE",  "storageLocation": "R-02-B", "chantier": null }
  ]
} ] }
```

### `GET /consumables` — consommables partagés + stock restant

### `GET /units/:code` — résoudre un code scanné

`:code` = n° d'exemplaire, code-barres **ou** QR. Renvoie l'exemplaire, le produit,
sa localisation actuelle et l'historique des sorties.

```json
{
  "unit": { "assetTag": "BRL-0142", "state": "ON_SITE" },
  "product": { "id": "...", "name": "Ponceuse girafe", "kind": "MACHINE" },
  "location": { "type": "CHANTIER", "chantier": { "name": "Rue Haute 12", "externalRef": "CH-2026-014" }, "since": "...", "loanId": "...", "takenBy": "Kévin" },
  "history": [ ... ]
}
```

`location.type` : `DEPOT` · `CHANTIER` · `RENTED` (loué à un client Bricoloc) ·
`MAINTENANCE` · `DAMAGED` · `RETIRED`.

---

## 3. Sorties / retours chantier

### `POST /loans` — sortie chantier

```json
{ "code": "BRL-0142", "chantierRef": "CH-2026-014", "takenBy": "Kévin", "note": "manque le sac" }
```

- Vérifie que l'exemplaire est **disponible** (sinon `409` : déjà sorti / loué / en SAV).
- Passe l'exemplaire en `ON_SITE` → **il disparaît automatiquement des disponibilités
  de location Bricoloc** jusqu'au retour.
- `201` → `{ "loan": { "id", "takenAt" }, "unit": {...}, "chantier": {...} }`

### `POST /returns` — retour au dépôt

```json
{ "code": "BRL-0142", "returnedBy": "Kévin", "note": "RAS", "toState": "AVAILABLE" }
```

`toState` (optionnel) : `AVAILABLE` (défaut) · `MAINTENANCE` · `DAMAGED` si l'outil
revient abîmé.

---

## 4. Consommables

### `POST /consumption` — décompter une consommation

```json
{ "code": "8712345678901", "quantity": 6, "chantierRef": "CH-2026-014", "takenBy": "Kévin" }
```

- `code` (code-barres / slug) **ou** `productId`.
- Décrémente le stock commun (`stockQty`) et enregistre la quantité pour le chantier.
- `201` → `{ "log": {...}, "product": { "id", "name" }, "stockLeft": 42 }`

---

## Règles

- Un exemplaire **loué à un client Bricoloc** ne peut pas partir sur un chantier
  (et inversement) — c'est le même parc.
- Les sorties chantier sont **ouvertes** : l'outil reste « sur le chantier » tant
  qu'un retour n'est pas scanné.
- Un chantier doit être **synchronisé** (`POST /chantiers`) avant toute sortie.
- Côté Bricoloc, tout est visible dans **Admin → Parc chantier (JJD)** (secours
  manuel possible si l'API est indisponible).
