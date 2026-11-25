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