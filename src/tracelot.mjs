import xrpl from "xrpl";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

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