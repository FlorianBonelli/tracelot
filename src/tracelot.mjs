import xrpl from "xrpl";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

// Charge les seeds depuis le fichier .env
process.loadEnvFile();

const TESTNET = "wss://s.altnet.rippletest.net:51233";

export const ROLES = ["tannerie", "transporteur", "atelier", "boutique"];

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Empreinte SHA-256 d'un texte ou d'un fichier (Buffer)
function sha256(contenu) {
  return createHash("sha256").update(contenu).digest("hex");
}

// Ouvre la connexion au Testnet
export async function connecter() {
  const client = new xrpl.Client(TESTNET);
  await client.connect();
  return client;
}

// Retrouve le compte d'un acteur à partir de sa seed
export function compte(role) {
  const seed = process.env[`SEED_${String(role).toUpperCase()}`];
  if (!seed) throw new Error(`Acteur inconnu : ${role}`);
  return xrpl.Wallet.fromSeed(seed);
}

// Relit la fiche off-chain d'un lot
export function lireLot(lot) {
  return JSON.parse(readFileSync(`data/${lot}.json`, "utf8"));
}

// Traduction des principaux codes de refus du ledger
const EXPLICATIONS = {
  tecNO_ENTRY: "cet acteur ne détient pas le lot",
  tecNO_PERMISSION: "cet acteur n'a pas le droit de faire cette opération",
  tecINSUFFICIENT_RESERVE: "le compte n'a pas assez de XRP pour la réserve",
  tecNO_DST: "le compte destinataire n'existe pas sur le ledger",
  tecEXPIRED: "l'offre a expiré",
};

// Arrête tout si une transaction n'a pas réussi, avec un message lisible
function verifier(res, etape) {
  const code = res.result.meta.TransactionResult;
  if (code === "tesSUCCESS") return;
  const explication = EXPLICATIONS[code] ?? "transaction rejetée";
  throw new Error(`${etape} refusée par le ledger : ${explication} (${code})`);
}

// ---------------------------------------------------------------------------
// Créer un lot : un NFT émis par la tannerie
// ---------------------------------------------------------------------------
export async function creerLot(client, fiche) {
  const tannerie = compte("tannerie");

  // Empreinte de la fiche : la seule chose qui ira on-chain
  const empreinte = sha256(JSON.stringify(fiche));

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
  verifier(res, "Création");

  const nftId = xrpl.getNFTokenID(res.result.meta);

  // La fiche détaillée reste off-chain, dans le dossier data
  mkdirSync("data", { recursive: true });
  writeFileSync(
    `data/${fiche.lot}.json`,
    JSON.stringify({ fiche, empreinte, nftId, txCreation: res.result.hash }, null, 2)
  );

  return { nftId, empreinte, hash: res.result.hash };
}

// ---------------------------------------------------------------------------
// Documents joints à un transfert
// ---------------------------------------------------------------------------

// Nettoie un nom de fichier : lettres, chiffres, point, tiret et souligné uniquement
export function nomDocument(nom) {
  const sansDossier = String(nom).split(/[\\/]/).pop(); // garde le nom, sans le chemin
  const propre = sansDossier.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 60);
  if (!propre || propre.startsWith(".")) throw new Error("Nom de document invalide.");
  return propre;
}

// Chemin de la copie off-chain d'un document
export function cheminDocument(lot, nom) {
  return `data/documents/${lot}/${nomDocument(nom)}`;
}

// Le Memo d'un document : son nom et son empreinte, jamais son contenu
const FORMAT_DOCUMENT = /^DOCUMENT (\S+) sha256:([0-9a-f]{64})$/;

// ---------------------------------------------------------------------------
// Transférer la responsabilité d'un lot d'un acteur à un autre
// document (facultatif) : { nom, contenu } où contenu est un Buffer
// ---------------------------------------------------------------------------
export async function transfererLot(client, lot, de, vers, motif, document) {
  const cedant = compte(de);
  const receveur = compte(vers);
  const { nftId } = lireLot(lot);

  const memos = [
    {
      Memo: {
        MemoData: xrpl.convertStringToHex(
          `TRANSFERT ${lot} ${de} > ${vers} : ${motif}`
        ),
      },
    },
  ];

  // Document joint : on inscrit son empreinte on-chain, le fichier reste off-chain
  let preuveDocument = null;
  if (document) {
    const nom = nomDocument(document.nom);
    const empreinte = sha256(document.contenu);
    memos.push({
      Memo: { MemoData: xrpl.convertStringToHex(`DOCUMENT ${nom} sha256:${empreinte}`) },
    });
    preuveDocument = { nom, empreinte };
  }

  // 1. Le cédant propose le lot au receveur
  const offre = await client.submitAndWait(
    {
      TransactionType: "NFTokenCreateOffer",
      Account: cedant.address,
      NFTokenID: nftId,
      Amount: "0", // on transfère une responsabilité, pas une vente
      Destination: receveur.address, // seul le receveur peut accepter
      Flags: 1, // tfSellNFToken
      Memos: memos,
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

  // Le transfert a réussi : on garde la copie off-chain du document
  if (document) {
    mkdirSync(`data/documents/${lot}`, { recursive: true });
    writeFileSync(cheminDocument(lot, preuveDocument.nom), document.contenu);
  }

  return {
    hashOffre: offre.result.hash,
    hashAcceptation: acceptation.result.hash,
    document: preuveDocument,
  };
}

// ---------------------------------------------------------------------------
// Reconstitue l'historique d'un lot à partir du ledger
// ---------------------------------------------------------------------------
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

      // Lecture des Memos : le contexte, et éventuellement un document joint
      let memo = "";
      let document = null;
      for (const m of tx.Memos ?? []) {
        if (!m.Memo?.MemoData) continue;
        const texte = xrpl.convertHexToString(m.Memo.MemoData);
        const doc = texte.match(FORMAT_DOCUMENT);
        if (doc) document = { nom: doc[1], empreinte: doc[2] };
        else if (!memo) memo = texte;
      }

      const hash = e.hash ?? tx.hash;
      evenements.set(hash, {
        hash,
        ledger: e.ledger_index ?? tx.ledger_index,
        rang: e.meta.TransactionIndex,
        date: e.close_time_iso ?? xrpl.rippleTimeToISOTime(tx.date),
        type: tx.TransactionType,
        acteur: roleDe[tx.Account] ?? tx.Account,
        vers: roleDe[tx.Destination] ?? null,
        memo,
        document,
      });
    }
  }

  // Ordre chronologique : par ledger, puis par rang dans le ledger
  return [...evenements.values()].sort(
    (a, b) => a.ledger - b.ledger || a.rang - b.rang
  );
}

// ---------------------------------------------------------------------------
// État actuel d'un lot sur le ledger : qui le détient, et son empreinte on-chain
// Jusqu'à 5 essais, car un serveur du Testnet peut être en retard sur les autres
// ---------------------------------------------------------------------------
export async function etatLot(client, lot) {
  const { nftId } = lireLot(lot);
  for (let essai = 1; essai <= 5; essai++) {
    for (const role of ROLES) {
      try {
        const reponse = await client.request({
          command: "account_nfts",
          account: compte(role).address,
          ledger_index: "validated",
          limit: 400,
        });
        const nft = reponse.result.account_nfts.find((n) => n.NFTokenID === nftId);
        if (nft) {
          return { detenteur: role, empreinteOnChain: xrpl.convertHexToString(nft.URI) };
        }
      } catch {
        // serveur pas à jour : on réessaiera
      }
    }
    await pause(2000);
  }
  throw new Error(`Le lot ${lot} est introuvable sur le ledger.`);
}

// Compare l'empreinte recalculée de la fiche à celle inscrite dans le NFT
export async function verifierLot(client, lot) {
  const { fiche } = lireLot(lot);
  const empreinteCalculee = "sha256:" + sha256(JSON.stringify(fiche));
  const { detenteur, empreinteOnChain } = await etatLot(client, lot);
  return {
    fiche,
    detenteur,
    empreinteCalculee,
    empreinteOnChain,
    conforme: empreinteCalculee === empreinteOnChain,
  };
}

// ---------------------------------------------------------------------------
// Vérifie un document : son empreinte recalculée contre celle de la transaction
// contenu (facultatif) : Buffer du fichier présenté ; sinon la copie off-chain
// ---------------------------------------------------------------------------
export async function verifierDocument(client, lot, nom, contenu) {
  const nomPropre = nomDocument(nom);
  const evenements = await historiqueLot(client, lot);
  const preuve = evenements.find((e) => e.document?.nom === nomPropre);
  if (!preuve) {
    throw new Error(`Aucun document « ${nomPropre} » n'est joint aux transactions du lot ${lot}.`);
  }
  const fichier = contenu ?? readFileSync(cheminDocument(lot, nomPropre));
  const empreinteCalculee = sha256(fichier);
  return {
    nom: nomPropre,
    empreinteCalculee,
    empreinteOnChain: preuve.document.empreinte,
    conforme: empreinteCalculee === preuve.document.empreinte,
    jointPar: preuve.acteur,
    date: preuve.date,
    hash: preuve.hash,
  };
}
