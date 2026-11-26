import { readFileSync } from "node:fs";
import { connecter, verifierDocument } from "../src/tracelot.mjs";

// Usage : node cli/verifier-document.mjs LOT-001 bon-livraison.txt [fichier-a-verifier]
// Sans troisième argument, on vérifie la copie gardée dans data/documents
const [lot, nom, cheminFichier] = process.argv.slice(2);
if (!lot || !nom) {
  console.log("Usage : node cli/verifier-document.mjs LOT-001 bon-livraison.txt [fichier-a-verifier]");
  process.exit(1);
}

const client = await connecter();
try {
  const contenu = cheminFichier ? readFileSync(cheminFichier) : undefined;
  const r = await verifierDocument(client, lot, nom, contenu);
  console.log("Document            :", r.nom);
  console.log("Joint par           :", r.jointPar, "le", r.date);
  console.log("Empreinte calculée  : sha256:" + r.empreinteCalculee);
  console.log("Empreinte on-chain  : sha256:" + r.empreinteOnChain);
  console.log("Preuve              : https://testnet.xrpl.org/transactions/" + r.hash);
  console.log(r.conforme ? "RÉSULTAT : document authentique" : "RÉSULTAT : DOCUMENT MODIFIÉ, les empreintes diffèrent");
} catch (erreur) {
  console.log("Vérification impossible :", erreur.message);
}
await client.disconnect();
