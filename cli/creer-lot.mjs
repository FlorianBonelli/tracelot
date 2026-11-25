import { connecter, creerLot } from "../src/tracelot.mjs";

// Usage : node cli/creer-lot.mjs LOT-001 "cuir pleine fleur" "50 peaux"
const [lot, matiere, quantite] = process.argv.slice(2);
if (!lot) {
  console.log('Usage : node cli/creer-lot.mjs LOT-001 "cuir pleine fleur" "50 peaux"');
  process.exit(1);
}

const fiche = {
  lot,
  matiere: matiere ?? "cuir pleine fleur",
  quantite: quantite ?? "50 peaux",
  date: new Date().toISOString().slice(0, 10),
};

const client = await connecter();
const { nftId, empreinte, hash } = await creerLot(client, fiche);

console.log("Lot créé  :", fiche.lot);
console.log("NFT ID    :", nftId);
console.log("Empreinte :", empreinte);
console.log("Preuve    : https://testnet.xrpl.org/transactions/" + hash);

await client.disconnect();