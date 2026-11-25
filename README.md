# TraceLot

PoC de traçabilité de lots sur le XRP Ledger, réalisé pour le Blockchain Challenge XRPL (ING5).

Chaque lot de cuir est représenté par un NFT. Chaque transfert de responsabilité est une transaction signée par le cédant et acceptée par le receveur.

## Équipe

- Matthias AUBERT : chef de projet
- Florian BONELLI-DUQUESNOY : développeur XRPL
- Léopold ANDRE : développeur interface
- Marie LIGNON-COSCIOLIE : architecture et qualité

## Réseau

XRPL Testnet (wss://s.altnet.rippletest.net:51233). Comptes de test uniquement.

## Installation

    npm install

## Scripts de prise en main

    node tp/tp1-wallet.mjs
    node tp/tp2-paiement.mjs
    node tp/tp3-lot.mjs
    node tp/tp3-transfert.mjs