# Back-office — retours David (2026-09-01) à traiter

Priorité : intégré au **Lot 4 (Back-office)**, sauf mention contraire.

## 1. Tableau de bord
- **Actuel** : liste de compteurs + tableau brut. Peu visuel, peu lisible.
- **Cible** : vrai dashboard opérationnel — KPI en tuiles avec tendance, mini-graphes
  (locations/jour, CA, taux d'occupation du parc), file du jour (retraits / retours attendus),
  alertes (dommages non traités, maintenances à faire, tickets ouverts, réservations non préparées),
  raccourcis. Lisible d'un coup d'œil.

## 2. Comptoir (retrait / retour)
- **Scan caméra** : impossible aujourd'hui de scanner avec un appareil, il faut taper le numéro.
  → bouton « Scanner » qui ouvre la caméra (getUserMedia + BarcodeDetector / lib fallback),
  + capture clavier-wedge automatique (Zebra TC51 / douchette USB) : une rafale finissant par Entrée = un scan.
  Route selon le préfixe : `R-*`/`BRL-*` → réservation, `U-*` → exemplaire, `SKU` → produit. **(pull depuis Lot 5)**
- **Voir les commandes en cours** : l'écran ne montre qu'une recherche. Ajouter une **file** :
  retraits à préparer / prêts / en cours / retours attendus aujourd'hui, cliquables.
- « L'onglet n'est pas pratique » → repenser l'ergonomie : scan-first, file visible, gros boutons.

## 3. Réservations
- OK en consultation, mais **pas modifiable en back-office**.
- → **éditeur de réservation** complet : dates, mode (retrait/livraison), adresse, statut,
  **ajout / suppression / modification de lignes** (produit, quantité, période exceptionnelle par ligne),
  ajustement de prix, ajout de frais/remise, régénération du devis + de la facture.

## 4. Création / édition de produit
- **Upload d'images en drag & drop** (glisser plusieurs fichiers, réordonner, définir l'image principale, supprimer).
- Reste : formulaire par onglets, constructeur de paliers de prix, sélecteurs d'associations. **(déjà Lot 4)**

## 5. Exemplaires & maintenance — « ne fonctionne pas bien »
- **Menu contextuel** (clic droit) / **appui long** sur un exemplaire → changer le statut,
  ajouter une réparation, ajouter un entretien, voir l'historique, générer l'étiquette.
- **BUG à corriger** : un entretien enregistré **ne bloque pas** la machine pour les réservations.
  → la maintenance doit avoir une **période** (`startAt` / `endAt`, ou « immobilisée jusqu'à »).
  L'exemplaire est alors **retiré des disponibilités** sur cette période (le moteur de dispo doit
  traiter une maintenance planifiée comme une réservation bloquante). Statut `MAINTENANCE`
  automatique pendant la période, retour à `AVAILABLE` après.

## 6. Clients
- **Pas de fiche client complète**. → page détail : coordonnées éditables, **adresses**,
  type + remise négociée, historique des réservations, factures, cautions, tickets,
  bons de commande (pro), notes internes.

## 7. Zones de livraison + **tarif à la géolocalisation** (important)
- **Actuel** : on peut seulement *ajouter* une zone par préfixe de code postal. Pas d'édition/suppression.
  → CRUD complet des zones.
- **Nouveau modèle voulu** : le forfait se calcule **depuis l'adresse du client**.
  Exemple : dépôt Leeuw-Saint-Pierre → Overijse → ~20 km → *tarif 1*.
  Dès que le client saisit son adresse, le tarif se calcule **tout seul**.
  → À implémenter :
  1. **Adresse du dépôt** configurable (Setting).
  2. **Géocodage** de l'adresse client (adresse → lat/lng). Service : Nominatim/OSM (gratuit, sans clé, à mettre en cache) ; option Google Geocoding si besoin de précision.
  3. **Distance** dépôt → client : distance routière (OSRM public/self-host) ou vol d'oiseau × facteur 1,3.
  4. **Règle de prix** au choix (config admin) :
     - **par tranches de km** : 0–10 km → X € · 10–25 → Y € · 25–50 → Z € · au-delà → sur devis / hors zone
     - **ou au km** : forfait de base + N €/km
  5. Contrôle de zone desservie = distance max (au lieu des préfixes CP), les préfixes restant possibles en secours.
  6. Livraison offerte au-delà d'un montant de location (déjà prévu, à garder).

## 8. Contenus du site — « possibilités de modifs faibles »
- **Actuel** : clé / langue / titre / corps (textarea brut).
- **Cible** : éditeur **riche** (mise en forme + aperçu), images dans le contenu,
  plus de zones éditables (accroches du hero, intitulés de sections, items de FAQ structurés,
  blocs « comment ça marche », pied de page), le tout **par langue** (FR/NL/EN) avec auto-trad DeepL.

## 9. Équipe — « tout est figé »
- **Actuel** : création + désactivation seulement.
- → **édition** : nom, e-mail, rôle, actif/inactif, réinitialisation du mot de passe.

## Style
- **Bleu marine `#0B1D3A` jugé trop foncé** pour les grands aplats.
  → garder le navy exact pour le logo / le texte, introduire un **navy plus clair** (~`#15325C`)
  pour les grandes sections. Vérifier **contraste WCAG AA partout** (bon pour l'accessibilité et le SEO).

## 10. Caution = empreinte bancaire (style hôtel) — IMPORTANT

- **Voulu** : bloquer le montant de la caution **sans le débiter** (pré-autorisation / empreinte),
  puis au retour : **libérer** (annulation de l'empreinte) ou **capturer** tout / partie (retard, dommage, nettoyage).
- **Faisable** : oui.
  - Mollie : paiement en **capture manuelle / autorisation** → fonds bloqués, non débités ; puis `capture` (montant ≤ autorisé) ou annulation.
  - (ou Stripe : `PaymentIntent` `capture_method: manual` + capture partielle — très robuste, en secours si Mollie limite.)
- **Le modèle de données le prévoit déjà** : `Deposit { amount, status: HELD|PARTIAL_RELEASE|RELEASED|CAPTURED, capturedAmount }`.
  Il reste à brancher les appels réels du provider (Lot 7) + stocker l'ID d'autorisation et sa date d'expiration.
- **Décisions David (2026-09-01)** :
  1. **Bancontact ne peut PAS faire d'empreinte** (confirmé). Bancontact = paiement débité tout de suite.
     → 3 modes de caution possibles :
       - **Carte (Visa/MC)** : vraie empreinte (bloquée, non débitée) — mode par défaut en ligne.
       - **Bancontact / carte débitée** : caution encaissée pour de vrai puis **remboursée** au retour (l'argent bouge ~2-3 j). Proposé si le client n'a pas de carte de crédit.
       - **Espèces au comptoir** : caution physique, **uniquement pour clic & collect**. `Deposit { method: CASH }`.
  2. **Durée de l'empreinte** : elle doit être **restituée dès la fin de location si tout est OK** (= flux normal, au contrôle retour). Cas particulier : les autorisations carte **expirent seules après ~28 j** (Mollie) → pour une location > 28 j, ré-autoriser avant expiration OU basculer cette location sur caution encaissée+remboursée. Rare (majorité = jour/semaine).
  3. Vérifier que l'**autorisation / capture manuelle** est activée sur le compte Mollie.

## 11. Paiement à l'enlèvement (clic & collect uniquement)

- **Voulu** : si le client choisit le **retrait au dépôt**, il peut payer **sur place** — en **espèces ou par carte** — au lieu de payer en ligne. La **caution** peut alors être laissée **en liquide** au comptoir.
- **Portée** : uniquement le mode retrait. La **livraison** reste payée en ligne (loyer + empreinte caution) avant expédition.
- À implémenter :
  1. Checkout : à l'étape paiement, si mode = retrait → choix « Payer maintenant en ligne » **ou** « Payer à l'enlèvement ». La réservation part en statut `CONFIRMED` avec `paymentStatus: ON_PICKUP`.
  2. Modèle : `Order.paymentMethod ∈ { ONLINE, ON_SITE_CASH, ON_SITE_CARD }`, `Order.paymentStatus ∈ { PENDING, ON_PICKUP, PAID, REFUNDED }`.
  3. Comptoir : au retrait, l'employé encaisse (espèces/carte, montant affiché), enregistre la **caution espèces** (`Deposit{method:CASH,status:HELD}`), imprime le reçu. Au retour : caution rendue (`RELEASED`) ou retenue partielle/totale (`CAPTURED`, motif).
  4. Le paiement en ligne (Mollie) reste obligatoire pour la livraison et proposé par défaut partout.

## 12. Catalogue partenaire Loiselet (Lot 3)

**Positionnement Bricoloc** (à garder en tête pour tout le site) : cible **n°1 = le particulier** — les gros acteurs de la location visent tous le pro, personne ne sert vraiment le particulier alors que la demande monte. Les **BricoPacks** sont l'outil de cette cible. Loiselet = complément **pour les pros / les grosses machines** qu'on n'a pas.

- **But** : proposer le catalogue Loiselet (loiselet.be) en plus du nôtre pour combler les manques, surtout grosses machines / pros.
- **Récupération des données** : scraper leur site (catalogue + fiches + photos + prix affichés). Pas d'API connue → crawler + import, à re-synchroniser périodiquement.
- **Prix** : Bricoloc a **−25 % sur le prix affiché Loiselet** (c'est notre coût). Le prix montré au client = **prix affiché Loiselet** (la marge de 25 % est pour nous). `Product.supplier = LOISELET`, stocker `supplierListPrice` + `supplierDiscountPct = 0.25` → `cost = list × 0.75`, `price client = list`.
- **Disponibilité** : **pas instantanée** — à confirmer, mais Loiselet confirme **dans l'heure**. Flux :
  1. Le client ajoute un article Loiselet au panier → marqué « disponibilité à confirmer ».
  2. À la commande : réservation en statut `PENDING_SUPPLIER` (nouveau), paiement **pré-autorisé** (empreinte) mais **pas capturé**.
  3. Le système **envoie une demande de location à Loiselet par e-mail** (e-mail structuré + entrée dans une file back-office « Demandes Loiselet »). Contenu : article(s), dates, adresse livraison/retrait, réf. commande Bricoloc. **Adresse destinataire = Setting `loiselet.requestEmail` modifiable en admin** (pas encore connue).
  4. Loiselet répond OK/KO (via lien de confirmation dans l'e-mail, ou l'équipe Bricoloc coche dans la file) → si OK : réservation `CONFIRMED`, paiement capturé, client notifié ; si KO : proposition d'alternative ou remboursement/annulation de l'empreinte.
  5. SLA affiché au client : « réponse sous 1 h (heures ouvrables) ».
- **Livraison des articles Loiselet** :
  - **Volumineux** → **sur devis** (Loiselet livre ; on répercute / on chiffre à la main). Pas de prix auto.
  - **Petit** → livraison **depuis Bricoloc** (retrait chez nous puis notre tournée), tarif géo normal (§7).
  - Champ `Product.deliveryPolicy ∈ { STANDARD, QUOTE_ONLY }` (Loiselet volumineux = QUOTE_ONLY).
- **Affichage site** : badge « Partenaire Loiselet » discret sur la fiche, mention « disponibilité confirmée sous 1 h », pas de bouton « réserver maintenant » instantané mais « demander cet équipement ».

## 13. Consommables & accessoires par outil (Lots 2–3)

- **Voulu** : sur **chaque fiche outil**, proposer les **consommables / accessoires adaptés** — p. ex. foreuse → bonnes mèches selon la marque ; ponceuse → bon papier abrasif ; etc. Avec de **vraies références trouvables en Belgique**.
- **Fournisseurs équipement / consommables** : **Cipac, Lecot, Sanimat (Wavre), BMK**. → table `Supplier`, chaque consommable rattaché à un fournisseur + référence fabricant + réf. fournisseur.
- **Modèle** : le schéma a déjà `ProductLink` (associations produit↔produit). L'étendre : type de lien `ACCESSORY` / `CONSUMABLE` / `REQUIRED` / `RECOMMENDED`, quantité conseillée, compatibilité (marque/modèle de la machine). Bloc « Complétez votre location » sur la fiche + ajout en 1 clic au panier (mêmes dates pour les accessoires louables, vente ferme pour les consommables).
- **Données** : à constituer au Lot 3 avec les catalogues Cipac/Lecot/Sanimat/BMK (références réelles). Ne pas inventer de références.