import xrpl from "xrpl";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

// Charge les seeds depuis le fichier .env
process.loadEnvFile();

const TESTNET = "wss://s.altnet.rippletest.net:51233";

// Ouvre la connexion au Testnet
export async function connecter() {
  const client = new xrpl.Client(TESTNET);
  await client.connect();
  return client;
}

// Retrouve le compte d'un acteur à partir de sa seed
export function compte(role) {
  const seed = process.env[`SEED_${role.toUpperCase()}`];
  if (!seed) throw new Error(`Acteur inconnu : ${role}`);
  return xrpl.Wallet.fromSeed(seed);
}

// Crée un lot : un NFT émis par la tannerie
export async function creerLot(client, fiche) {
  const tannerie = compte("tannerie");

  // Empreinte de la fiche : la seule chose qui ira on-chain
  const empreinte = createHash("sha256")
    .update(JSON.stringify(fiche))
    .digest("hex");

  const res = await client.submitAndWait(
    {
      TransactionType: "NFTokenMint",
      Account: tannerie.address,
      NFTokenTaxon: 0,
      Flags: 8, // tfTransferable
      URI: xrpl.convertStringToHex("sha256:" + empreinte),
      Memos: [
        { Memo: { MemoData: xrpl.convertStringToHex("CREATION " + fiche.lot) } },
      ],
    },
    { wallet: tannerie }
  );

  const resultat = res.result.meta.TransactionResult;
  if (resultat !== "tesSUCCESS") throw new Error("Échec : " + resultat);

  const nftId = xrpl.getNFTokenID(res.result.meta);

  // La fiche détaillée reste off-chain, dans le dossier data
  mkdirSync("data", { recursive: true });
  writeFileSync(
    `data/${fiche.lot}.json`,
    JSON.stringify({ fiche, empreinte, nftId, txCreation: res.result.hash }, null, 2)
  );

  return { nftId, empreinte, hash: res.result.hash };
}

// Relit la fiche off-chain d'un lot
export function lireLot(lot) {
  return JSON.parse(readFileSync(`data/${lot}.json`, "utf8"));
}

// Arrête tout si une transaction n'a pas réussi
function verifier(res, etape) {
  const resultat = res.result.meta.TransactionResult;
  if (resultat !== "tesSUCCESS") throw new Error(`${etape} refusée : ${resultat}`);
}

// Transfère la responsabilité d'un lot d'un acteur à un autre
export async function transfererLot(client, lot, de, vers, motif) {
  const cedant = compte(de);
  const receveur = compte(vers);
  const { nftId } = lireLot(lot);

  // 1. Le cédant propose le lot au receveur
  const offre = await client.submitAndWait(
    {
      TransactionType: "NFTokenCreateOffer",
      Account: cedant.address,
      NFTokenID: nftId,
      Amount: "0", // on transfère une responsabilité, pas une vente
      Destination: receveur.address, // seul le receveur peut accepter
      Flags: 1, // tfSellNFToken
      Memos: [
        {
          Memo: {
            MemoData: xrpl.convertStringToHex(
              `TRANSFERT ${lot} ${de} > ${vers} : ${motif}`
            ),
          },
        },
      ],
    },
    { wallet: cedant }
  );
  verifier(offre, "Offre");

  const offreId =
    offre.result.meta.offer_id ??
    offre.result.meta.AffectedNodes.find(
      (n) => n.CreatedNode?.LedgerEntryType === "NFTokenOffer"
    ).CreatedNode.LedgerIndex;

  // 2. Le receveur accepte : il devient responsable du lot
  const acceptation = await client.submitAndWait(
    {
      TransactionType: "NFTokenAcceptOffer",
      Account: receveur.address,
      NFTokenSellOffer: offreId,
    },
    { wallet: receveur }
  );
  verifier(acceptation, "Acceptation");

  return {
    hashOffre: offre.result.hash,
    hashAcceptation: acceptation.result.hash,
  };
}

export const ROLES = ["tannerie", "transporteur", "atelier", "boutique"];

// Reconstitue l'historique d'un lot à partir du ledger
export async function historiqueLot(client, lot) {
  const { nftId } = lireLot(lot);

  // Table adresse > rôle, pour afficher des noms lisibles
  const roleDe = {};
  for (const role of ROLES) roleDe[compte(role).address] = role;

  const evenements = new Map(); // évite les doublons, par hash

  for (const adresse of Object.keys(roleDe)) {
    const reponse = await client.request({
      command: "account_tx",
      account: adresse,
      limit: 200,
    });

    for (const e of reponse.result.transactions) {
      const tx = e.tx_json ?? e.tx;
      const concerneLeLot =
        e.meta?.nftoken_id === nftId || tx.NFTokenID === nftId;
      if (!concerneLeLot) continue;
      if (e.meta.TransactionResult !== "tesSUCCESS") continue;

      const hash = e.hash ?? tx.hash;
      const memoHex = tx.Memos?.[0]?.Memo?.MemoData;
      evenements.set(hash, {
        hash,
        ledger: e.ledger_index ?? tx.ledger_index,
        rang: e.meta.TransactionIndex,
        date: e.close_time_iso ?? xrpl.rippleTimeToISOTime(tx.date),
        type: tx.TransactionType,
        acteur: roleDe[tx.Account] ?? tx.Account,
        vers: roleDe[tx.Destination] ?? null,
        memo: memoHex ? xrpl.convertHexToString(memoHex) : "",
      });
    }
  }

  // Ordre chronologique : par ledger, puis par rang dans le ledger
  return [...evenements.values()].sort(
    (a, b) => a.ledger - b.ledger || a.rang - b.rang
  );
}


// Lit l'état actuel d'un lot sur le ledger : qui le détient, et son empreinte on-chain
export async function etatLot(client, lot) {
  const { nftId } = lireLot(lot);
  for (const role of ROLES) {
    const reponse = await client.request({
      command: "account_nfts",
      account: compte(role).address,
      limit: 400,
    });
    const nft = reponse.result.account_nfts.find((n) => n.NFTokenID === nftId);
    if (nft) {
      return { detenteur: role, empreinteOnChain: xrpl.convertHexToString(nft.URI) };
    }
  }
  throw new Error(`Le lot ${lot} est introuvable sur le ledger.`);
}

// Compare l'empreinte recalculée de la fiche à celle inscrite dans le NFT
export async function verifierLot(client, lot) {
  const { fiche } = lireLot(lot);
  const empreinteCalculee =
    "sha256:" + createHash("sha256").update(JSON.stringify(fiche)).digest("hex");
  const { detenteur, empreinteOnChain } = await etatLot(client, lot);
  return {
    fiche,
    detenteur,
    empreinteCalculee,
    empreinteOnChain,
    conforme: empreinteCalculee === empreinteOnChain,
  };
}