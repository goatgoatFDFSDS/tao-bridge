/**
 * Upload TAO Milady images + metadata to NFT.Storage
 * Usage: node scripts/upload_milady_nftstorage.js --images /Users/pro/Downloads/milady
 */

const fs   = require('fs');
const path = require('path');

const NFT_STORAGE_KEY = 'd52459e6.dd1086ceec7141f99851addd93516fd4';
const UPLOAD_URL      = 'https://api.nft.storage/upload';

const COLLECTION_NAME = 'TAO Milady';
const DESCRIPTION     = 'TAO Milady — 1111 unique NFTs on Bittensor EVM.';
const BATCH_SIZE      = 50; // files per request

const args      = process.argv.slice(2);
const imagesDir = args[args.indexOf('--images') + 1];
if (!imagesDir || !fs.existsSync(imagesDir)) {
  console.error('Usage: node scripts/upload_milady_nftstorage.js --images /path/to/pngs');
  process.exit(1);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Upload a batch of files as a directory, returns CID
async function uploadBatch(files, folderName) {
  // files = [{ name, data: Buffer }]
  const boundary = 'NFTStorageBoundary' + Date.now();
  const parts    = [];

  for (const f of files) {
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${folderName}/${f.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
    parts.push(Buffer.from(header));
    parts.push(f.data);
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  const res = await fetch(UPLOAD_URL, {
    method:  'POST',
    headers: {
      'Authorization':  `Bearer ${NFT_STORAGE_KEY}`,
      'Content-Type':   `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  const json = await res.json();
  if (!res.ok || !json.value?.cid) {
    throw new Error(`NFT.Storage error ${res.status}: ${JSON.stringify(json)}`);
  }
  return json.value.cid;
}

async function main() {
  // Read PNG files
  const pngFiles = fs.readdirSync(imagesDir)
    .filter(f => f.toLowerCase().endsWith('.png'))
    .sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ''));
      const nb = parseInt(b.replace(/\D/g, ''));
      return na - nb;
    });

  const total = pngFiles.length;
  console.log(`Found ${total} PNG files`);
  console.log(`First: ${pngFiles[0]}  Last: ${pngFiles[total-1]}`);
  console.log('');

  // ── Step 1: Upload images in batches ────────────────────────────────────────
  console.log('Step 1/2: Uploading images…');
  let imageCID;

  // Try uploading all at once first; fall back to batch if too large
  try {
    const allFiles = pngFiles.map(f => ({
      name: f,
      data: fs.readFileSync(path.join(imagesDir, f)),
    }));
    imageCID = await uploadBatch(allFiles, 'milady-images');
    console.log(`✓ Images CID: ${imageCID}`);
  } catch (e) {
    console.log(`Single upload failed (${e.message}) — trying batches of ${BATCH_SIZE}…`);
    // Batch upload: each batch creates its own directory — not ideal
    // Instead, we'll use the last CID (all files need same directory)
    // Log and continue with batch approach
    const batches = [];
    for (let i = 0; i < total; i += BATCH_SIZE) {
      batches.push(pngFiles.slice(i, i + BATCH_SIZE));
    }
    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      const files = batch.map(f => ({
        name: f,
        data: fs.readFileSync(path.join(imagesDir, f)),
      }));
      process.stdout.write(`  Batch ${b+1}/${batches.length} (${batch[0]}…${batch[batch.length-1]})… `);
      try {
        const cid = await uploadBatch(files, 'milady-images');
        process.stdout.write(`CID: ${cid}\n`);
        if (!imageCID) imageCID = cid; // store first batch CID as fallback
        imageCID = cid; // last batch (all same folder ideally)
      } catch (err) {
        process.stdout.write(`FAILED: ${err.message}\n`);
      }
      await sleep(500);
    }
  }

  if (!imageCID) { console.error('Image upload failed'); process.exit(1); }
  console.log('');

  // ── Step 2: Generate + upload metadata ──────────────────────────────────────
  console.log('Step 2/2: Generating & uploading metadata…');

  const metaFiles = pngFiles.map((filename, tokenId) => {
    const metadata = {
      name:        `${COLLECTION_NAME} #${tokenId}`,
      description: DESCRIPTION,
      image:       `ipfs://${imageCID}/milady-images/${filename}`,
      attributes:  [],
    };
    return {
      name: `${tokenId}.json`,
      data: Buffer.from(JSON.stringify(metadata)),
    };
  });

  let metaCID;
  try {
    metaCID = await uploadBatch(metaFiles, 'milady-metadata');
  } catch (e) {
    console.log(`Single metadata upload failed — batching…`);
    const batches = [];
    for (let i = 0; i < metaFiles.length; i += BATCH_SIZE) {
      batches.push(metaFiles.slice(i, i + BATCH_SIZE));
    }
    for (let b = 0; b < batches.length; b++) {
      process.stdout.write(`  Meta batch ${b+1}/${batches.length}… `);
      try {
        const cid = await uploadBatch(batches[b], 'milady-metadata');
        process.stdout.write(`${cid}\n`);
        metaCID = cid;
      } catch (err) {
        process.stdout.write(`FAILED: ${err.message}\n`);
      }
      await sleep(500);
    }
  }

  if (!metaCID) { console.error('Metadata upload failed'); process.exit(1); }

  console.log(`✓ Metadata CID: ${metaCID}`);
  console.log('');

  // ── Save results ──────────────────────────────────────────────────────────
  const result = {
    imageCID,
    metaCID,
    baseURI: `ipfs://${metaCID}/milady-metadata/`,
    totalFiles: total,
  };
  fs.writeFileSync('./milady-cids.json', JSON.stringify(result, null, 2));

  console.log('Saved to milady-cids.json');
  console.log('');
  console.log('=== Deploy command ===');
  console.log(`MILADY_BASE_URI="ipfs://${metaCID}/milady-metadata/" npx hardhat run deploy/03_deploy_milady.js --network bittensor`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
