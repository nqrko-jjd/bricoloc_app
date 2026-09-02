# Terminal Zebra TC51 — mise en service

Le terminal équipe : `https://<domaine>/terminal` (ou `http://192.168.1.27:3000/terminal` en test local).

## Scanner : le lecteur physique, pas la caméra

Le TC51 a un **lecteur code-barres intégré** (bouton gâchette sur les côtés / la
poignée). **Aucun besoin de caméra ni de HTTPS pour scanner** : le lecteur se
comporte comme un clavier — il « tape » le code lu puis Entrée, et le champ de
scan de l'appli le reçoit directement.

La caméra (bouton « 📷 Caméra ») ne sert que sur un téléphone / une tablette
**sans** lecteur physique, et elle exige une connexion sécurisée (https). Sur le
Zebra, on utilise **toujours la gâchette**.

### Configuration DataWedge (une seule fois)

1. Ouvrir l'appli **DataWedge** sur le Zebra.
2. Profil **Profile0 (default)** — ou créer un profil associé à **Chrome**.
3. Dans le profil :
   - **Barcode input** : activé
   - **Keystroke output** : activé
   - **Keystroke output → Basic data formatting → Send ENTER key** : **activé**
     *(indispensable : c'est l'Entrée finale qui valide le scan)*
4. Fermer DataWedge. Ouvrir Chrome → page `/terminal` → toucher le champ de scan →
   viser un code → appuyer sur la gâchette.

### Installer en plein écran

Chrome → menu ⋮ → **Ajouter à l'écran d'accueil**. L'appli s'ouvre alors sans la
barre d'adresse, en plein écran portrait.

## Ce qu'on peut faire au dépôt avec le Zebra

Écran d'accueil = 4 grosses touches :

| Touche | Usage |
|---|---|
| **Comptoir** | Retrait / retour client, guidé pas à pas : scan de la résa → paiement / caution → scan de chaque machine → contrôle + photos → signature client → sortie. Retour en miroir. |
| **Stock** | Liste des machines (avec photo) : dispo / total. Scan ou touche d'une machine → ses exemplaires → changement d'état direct. Onglet Consommables. |
| **Réparations** | Exemplaires « à réparer » / « en réparation » / « entretien à prévoir ». Scan ou touche → remettre en service / mettre en réparation / signaler endommagé / hors service. |
| **Inventaire** | On scanne les exemplaires « disponibles » un par un. Décompte par machine, et liste des exemplaires non retrouvés à la fin. |

## HTTPS en local (test caméra uniquement)

En production sur Combell, le HTTPS est automatique — rien à faire.
Pour tester la **caméra** sur un appareil non-Zebra avant le déploiement :
double-clic sur `LANCER-HTTPS-TEST.cmd` (tunnel Cloudflare, adresse https
temporaire). Inutile pour le Zebra.
