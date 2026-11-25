import xrpl from "xrpl";

const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
await client.connect();

// Deux acteurs de la filière
const { wallet: tannerie } = await client.fundWallet();
const { wallet: transporteur } = await client.fundWallet();
console.log("Tannerie     :", tannerie.address);
console.log("Transporteur :", transporteur.address);

// 1. La tannerie crée le lot (comme dans tp3-lot.mjs)
const mint = await client.submitAndWait(
  {
    TransactionType: "NFTokenMint",
    Account: tannerie.address,
    NFTokenTaxon: 0,
    Flags: 8, // tfTransferable
    URI: xrpl.convertStringToHex("LOT-001"),
  },
  { wallet: tannerie }
);
const nftId = xrpl.getNFTokenID(mint.result.meta);
console.log("Lot créé     :", nftId);

// 2. La tannerie propose de céder le lot au transporteur
const offre = await client.submitAndWait(
  {
    TransactionType: "NFTokenCreateOffer",
    Account: tannerie.address,
    NFTokenID: nftId,
    Amount: "0", // cession gratuite : on transfère une responsabilité, pas une vente
    Destination: transporteur.address, // seul le transporteur peut accepter
    Flags: 1, // tfSellNFToken : offre de cession
    Memos: [
      { Memo: { MemoData: xrpl.convertStringToHex("Remise au transporteur") } },
    ],
  },
  { wallet: tannerie }
);
// Identifiant de l'offre créée
const offreId =
  offre.result.meta.offer_id ??
  offre.result.meta.AffectedNodes.find(
    (n) => n.CreatedNode?.LedgerEntryType === "NFTokenOffer"
  ).CreatedNode.LedgerIndex;
console.log("Offre        :", offre.result.meta.TransactionResult, offreId);

// 3. Le transporteur accepte : il devient responsable du lot
const accept = await client.submitAndWait(
  {
    TransactionType: "NFTokenAcceptOffer",
    Account: transporteur.address,
    NFTokenSellOffer: offreId,
  },
  { wallet: transporteur }
);
console.log("Acceptation  :", accept.result.meta.TransactionResult);
console.log("Hash         :", accept.result.hash);

// 4. Vérification : qui détient le lot maintenant ?
const nftsTannerie = await client.request({
  command: "account_nfts",
  account: tannerie.address,
});
const nftsTransporteur = await client.request({
  command: "account_nfts",
  account: transporteur.address,
});
console.log("NFT chez la tannerie     :", nftsTannerie.result.account_nfts.length);
console.log("NFT chez le transporteur :", nftsTransporteur.result.account_nfts.length);

await client.disconnect();