# TraceLot

PoC de traçabilité de lots sur le XRP Ledger, réalisé pour le Blockchain Challenge XRPL (ING5).

Un lot de cuir passe de la tannerie à la boutique. Chaque lot est un NFT, et chaque transfert de responsabilité est une offre signée par le cédant puis acceptée par le receveur. L'historique est reconstitué directement depuis le ledger.

## Équipe

- Matthias AUBERT : chef de projet
- Florian BONELLI-DUQUESNOY : développeur XRPL
- Léopold ANDRE : développeur interface
- Marie LIGNON-COSCIOLIE : architecture et qualité

## Réseau et comptes de test

Réseau : XRPL Testnet (`wss://s.altnet.rippletest.net:51233`), explorateur : https://testnet.xrpl.org

| Acteur | Adresse |
| --- | --- |
| Tannerie | rnqd1NrLay5ZPvureDtAELuwRjhNEjyuaq |
| Transporteur | rNofAnZkW5XA7k2ZyeSA7TQu51oWCNLQaq |
| Atelier | rHLQvCJn4PMwDHXwwwiLve2o8cngdof4MP |
| Boutique | r9wMafdZUP3oSyp2yVj2q5M7d48LfuV94h |

## Architecture

- **On-chain** : le NFT du lot, l'empreinte SHA-256 de sa fiche, les transferts et leurs Memos.
- **Off-chain** : la fiche détaillée du lot (dossier `data`, non versionné).
- **Aucune donnée personnelle on-chain.**
- **Clés** : comptes de test uniquement, seeds dans un fichier `.env` exclu de Git.

| Fonctionnalité | Transaction XRPL |
| --- | --- |
| Créer un lot | NFTokenMint |
| Transférer la responsabilité | NFTokenCreateOffer puis NFTokenAcceptOffer |
| Consulter l'historique | Requête account_tx, filtrée sur le NFT |

## Installation

Prérequis : Node.js 22 ou plus récent, Git.

```
git clone https://github.com/FlorianBonelli/tracelot.git
cd tracelot
npm install
node scripts/setup-comptes.mjs
```

La dernière commande crée quatre comptes de test et écrit leurs seeds dans `.env`.

## Scénario de démonstration

```
node cli/creer-lot.mjs LOT-002
node cli/transferer-lot.mjs LOT-002 tannerie transporteur "Remise au transporteur"
node cli/transferer-lot.mjs LOT-002 transporteur atelier "Livraison à l'atelier"
node cli/transferer-lot.mjs LOT-002 atelier boutique "Produit fini livré en boutique"
node cli/historique.mjs LOT-002
```

Tentative de fraude : un acteur qui ne détient plus le lot essaie de le céder. Le ledger refuse avec `tecNO_ENTRY`.

```
node cli/transferer-lot.mjs LOT-002 tannerie atelier "Tentative de fraude"
```

Chaque commande affiche un lien vers la transaction dans l'explorateur.

## Interface web

```
node server.mjs
```

Puis ouvrir http://localhost:3000. La page permet de créer un lot, de transférer sa responsabilité et de consulter son historique. Les seeds restent côté serveur : le navigateur ne voit que les adresses publiques.

## Limites

- La blockchain garantit que la donnée n'a pas été modifiée, pas qu'elle était vraie à la saisie.
- Le lien entre le lot physique et son NFT se fait hors chaîne.
- Dans ce PoC, les quatre seeds sont sur le même poste ; en production, chaque acteur garderait la sienne.