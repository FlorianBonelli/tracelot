import { connecter, historiqueLot } from "../src/tracelot.mjs";

// Usage : node cli/historique.mjs LOT-001
const [lot] = process.argv.slice(2);
if (!lot) {
  console.log("Usage : node cli/historique.mjs LOT-001");
  process.exit(1);
}

const client = await connecter();
const evenements = await historiqueLot(client, lot);

console.log(`Historique du lot ${lot}\n`);
let detenteur = "inconnu";

for (const e of evenements) {
  let texte = e.type;
  if (e.type === "NFTokenMint") {
    texte = `Création du lot par : ${e.acteur}`;
    detenteur = e.acteur;
  } else if (e.type === "NFTokenCreateOffer") {
    texte = `${e.acteur} propose le lot à : ${e.vers}`;
  } else if (e.type === "NFTokenAcceptOffer") {
    texte = `${e.acteur} accepte le lot et en devient responsable`;
    detenteur = e.acteur;
  }
  console.log(e.date, "|", texte);
  if (e.memo) console.log("   Memo     :", e.memo);
  if (e.document) {
    console.log("   Document :", e.document.nom, "(sha256:" + e.document.empreinte.slice(0, 16) + "…)");
  }
  console.log("   Preuve   : https://testnet.xrpl.org/transactions/" + e.hash);
}

console.log("\nDétenteur actuel :", detenteur);
await client.disconnect();
