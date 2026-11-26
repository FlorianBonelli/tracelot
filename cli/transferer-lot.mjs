import { readFileSync } from "node:fs";
import { connecter, transfererLot } from "../src/tracelot.mjs";

// Usage : node cli/transferer-lot.mjs LOT-001 tannerie transporteur "Remise au transporteur" [document]
// Le document est facultatif : c'est le chemin d'un fichier à joindre au transfert
const [lot, de, vers, motif, cheminFichier] = process.argv.slice(2);
if (!lot || !de || !vers) {
  console.log('Usage : node cli/transferer-lot.mjs LOT-001 tannerie transporteur "Remise au transporteur" [document]');
  process.exit(1);
}

const client = await connecter();
try {
  const document = cheminFichier
    ? { nom: cheminFichier, contenu: readFileSync(cheminFichier) }
    : undefined;

  const r = await transfererLot(
    client, lot, de, vers, motif ?? "Transfert de responsabilité", document
  );
  console.log(`Lot ${lot} transféré : ${de} > ${vers}`);
  console.log("Offre       : https://testnet.xrpl.org/transactions/" + r.hashOffre);
  console.log("Acceptation : https://testnet.xrpl.org/transactions/" + r.hashAcceptation);
  if (r.document) {
    console.log("Document    :", r.document.nom);
    console.log("Empreinte   : sha256:" + r.document.empreinte);
  }
} catch (erreur) {
  console.log("Transfert impossible :", erreur.message);
}
await client.disconnect();
