# TraceLot

PoC de traçabilité de lots sur le XRP Ledger, réalisé pour le Blockchain Challenge XRPL (ING5).

Un lot de cuir passe de la tannerie à la boutique. Chaque lot est un NFT, et chaque transfert de responsabilité est une offre signée par le cédant puis acceptée par le receveur. L'historique est reconstitué directement depuis le ledger, et l'intégrité de la fiche d'un lot est vérifiable par comparaison d'empreintes.

## Équipe

- Matthias AUBERT : chef de projet
- Florian BONELLI-DUQUESNOY : développeur XRPL
- Léopold ANDRE : développeur interface
- Marie LIGNON-COSCIOLIE : architecture et qualité

## Réseau et comptes de test

Réseau : XRPL Testnet (`wss://s.altnet.rippletest.net:51233`), explorateur : https://testnet.xrpl.org

| Acteur | Adresse |
| --- | --- |
| Tannerie | rECKinLJeiYebGFgx243znjFct86papmy2 |
| Transporteur | rnPUiHYpnQeAUtJaZAYh948ReNGXR3bYCL |
| Atelier | rBzvW58bbfuSTFvi6j2Z8s7Af5JNyA9FNf |
| Boutique | rnAgfkSdPNiszdid4BSLUw4iwGE8wLokAD |

Le Testnet est un réseau d'essai : il a été remis à zéro dans la nuit du 25 au 26 novembre 2026. Si ces comptes n'existent plus, la commande `node scripts/setup-comptes.mjs` en recrée quatre (voir Installation).

## Architecture

![Architecture de TraceLot](docs/architecture.png)

- **On-chain** : le NFT du lot, l'empreinte SHA-256 de sa fiche, les transferts et leurs Memos.
- **Off-chain** : la fiche détaillée du lot (dossier `data`, non versionné), la page web et le serveur.
- **Aucune donnée personnelle on-chain.**
- **Clés** : comptes de test uniquement, seeds dans un fichier `.env` exclu de Git. Seul le serveur les manipule ; le navigateur ne voit que les adresses publiques.

| Fonctionnalité | Brique XRPL |
| --- | --- |
| Créer un lot | Transaction NFTokenMint, avec l'empreinte de la fiche dans l'URI |
| Transférer la responsabilité | Transactions NFTokenCreateOffer puis NFTokenAcceptOffer |
| Consulter l'historique | Requête account_tx, filtrée sur le NFT |
| Connaître le détenteur actuel | Requête account_nfts |
| Vérifier l'intégrité d'une fiche | Empreinte recalculée, comparée à celle du NFT lue par account_nfts |

### Organisation du code

| Fichier ou dossier | Rôle |
| --- | --- |
| `src/tracelot.mjs` | Logique XRPL : création, transfert, historique, état et vérification d'un lot |
| `cli/` | Une commande par fonctionnalité |
| `server.mjs` | Serveur web local, qui expose la logique à la page |
| `public/index.html` | Interface web |
| `scripts/setup-comptes.mjs` | Création des quatre comptes de test |
| `tp/` | Scripts de prise en main (TP 1 à 3) |
| `acteurs.json` | Adresses publiques des acteurs |

## Installation

Prérequis : Node.js 22 ou plus récent, Git.

```
git clone https://github.com/FlorianBonelli/tracelot.git
cd tracelot
npm install
node scripts/setup-comptes.mjs
```

La dernière commande crée quatre comptes de test, écrit leurs seeds dans `.env` et leurs adresses dans `acteurs.json`. Elle ne fait rien si un fichier `.env` existe déjà.

## Scénario de démonstration

### En ligne de commande

Le lot parcourt toute la filière :

```
node cli/creer-lot.mjs LOT-002
node cli/transferer-lot.mjs LOT-002 tannerie transporteur "Remise au transporteur"
node cli/transferer-lot.mjs LOT-002 transporteur atelier "Livraison à l'atelier"
node cli/transferer-lot.mjs LOT-002 atelier boutique "Produit fini livré en boutique"
node cli/historique.mjs LOT-002
```

Tentative de fraude : un acteur qui ne détient plus le lot essaie de le céder. Le ledger refuse avec le code `tecNO_ENTRY`.

```
node cli/transferer-lot.mjs LOT-002 tannerie atelier "Tentative de fraude"
```

Vérification d'intégrité : l'empreinte de la fiche est recalculée et comparée à celle inscrite dans le NFT.

```
node cli/verifier-lot.mjs LOT-002
```

Chaque commande de création ou de transfert affiche un lien vers la transaction dans l'explorateur.

### Dans l'interface web

```
node server.mjs
```

Puis ouvrir http://localhost:3000.

1. **Créer un lot** : la tannerie émet le NFT.
2. **Transférer la responsabilité** : le détenteur actuel est lu sur le ledger et le formulaire est prérempli avec l'acteur suivant.
3. **Historique d'un lot** : chaque étape renvoie à sa preuve dans l'explorateur.
4. **Vérifier l'intégrité d'une fiche** : les deux empreintes sont affichées côte à côte. Les boutons « Simuler une falsification » et « Restaurer la fiche » modifient uniquement le fichier off-chain, pour montrer que la fraude est détectée.

## Limites

- La blockchain garantit que la donnée n'a pas été modifiée, pas qu'elle était vraie à la saisie.
- Le lien entre le lot physique et son NFT se fait hors chaîne.
- Dans ce PoC, les quatre seeds sont sur le même poste ; en production, chaque acteur garderait la sienne dans son propre portefeuille.
- L'historique interroge les comptes connus de la filière ; un acteur inconnu ne serait pas couvert.
- Le PoC vérifie qui détient le lot, pas que l'ordre de la filière est respecté.
- Les fiches off-chain sont stockées localement : leur disponibilité dépend d'un stockage classique.
