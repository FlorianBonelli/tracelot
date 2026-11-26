import { connecter, verifierLot } from "../src/tracelot.mjs";

// Usage : node cli/verifier-lot.mjs LOT-002
const [lot] = process.argv.slice(2);
if (!lot) {
  console.log("Usage : node cli/verifier-lot.mjs LOT-002");
  process.exit(1);
}

const client = await connecter();
try {
  const r = await verifierLot(client, lot);
  console.log("Fiche off-chain     :", JSON.stringify(r.fiche));
  console.log("Empreinte calculée  :", r.empreinteCalculee);
  console.log("Empreinte on-chain  :", r.empreinteOnChain);
  console.log("Détenteur actuel    :", r.detenteur);
  console.log(r.conforme ? "RÉSULTAT : fiche conforme" : "RÉSULTAT : FICHE MODIFIÉE, les empreintes diffèrent");
} catch (erreur) {
  console.log("Vérification impossible :", erreur.message);
}
await client.disconnect();