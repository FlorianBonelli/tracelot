import xrpl from "xrpl";
import { createHash } from "node:crypto";

const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
await client.connect();

// Le compte de la tannerie, qui crée le lot
const { wallet: tannerie } = await client.fundWallet();
console.log("Tannerie :", tannerie.address);

// La fiche du lot reste HORS chaîne (off-chain)
const fiche = {
  lot: "LOT-001",
  matiere: "cuir pleine fleur",
  quantite: "50 peaux",
  date: "2026-11-25",
};

// Seule son empreinte (hash SHA-256) ira sur la blockchain
const empreinte = createHash("sha256")
  .update(JSON.stringify(fiche))
  .digest("hex");
console.log("Empreinte :", empreinte);

// Création du NFT qui représente le lot
// submitAndWait avec { wallet } prépare, signe et soumet en une fois
const res = await client.submitAndWait(
  {
    TransactionType: "NFTokenMint",
    Account: tannerie.address,
    NFTokenTaxon: 0, // catégorie du NFT, 0 par défaut
    Flags: 8, // tfTransferable : le lot pourra changer de détenteur
    URI: xrpl.convertStringToHex("sha256:" + empreinte),
    Memos: [
      { Memo: { MemoData: xrpl.convertStringToHex("Creation LOT-001") } },
    ],
  },
  { wallet: tannerie }
);

console.log("Résultat :", res.result.meta.TransactionResult);
console.log("Hash     :", res.result.hash);
console.log("NFT ID   :", xrpl.getNFTokenID(res.result.meta));

await client.disconnect();