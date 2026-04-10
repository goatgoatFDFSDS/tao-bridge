/**
 * Upload TAO Milady images + metadata to Pinata via API
 * Usage:
 *   node scripts/upload_milady_pinata.js --images /chemin/vers/pngs
 *
 * Steps:
 *   1. Upload images folder → get IMAGE_CID
 *   2. Generate metadata JSONs with correct image CID
 *   3. Upload metadata folder → get METADATA_CID
 */

const fs   = require('fs');
const path = require('path');

const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI5NjVlZDAxNS1hYzhlLTQ5YmQtYjliMS02MmQyYTIyYjY3YzgiLCJlbWFpbCI6ImdvYXRibmIyOEBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiZjFiNGViM2NjNGYwZmI4NDIzNTgiLCJzY29wZWRLZXlTZWNyZXQiOiJjODUyMDk5YjZkYmE2OTZlZmFkZGFmMTg0ZmEwMGRiMWQ5MDVhYjYxOTcwYTE0NmIyYWRjYmY1MDBlZTNlZDNmIiwiZXhwIjoxODA3MzU2OTUzfQ.Jku9-pYIwq1pwQHS3YjMy1w2ujBXu8zaF86_Cln0oPs';
const PIN_URL    = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

const COLLECTION_NAME = 'TAO Milady';
const DESCRIPTION     = 'TAO Milady — 1111 unique NFTs on Bittensor EVM.';

// ── Args ──────────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const imagesDir = args[args.indexOf('--images') + 1];
if (!imagesDir || !fs.existsSync(imagesDir)) {
  console.error('Usage: node scripts/upload_milady_pinata.js --images /path/to/pngs');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function uploadFolder(files, folderName) {
  // files = [{ name, data: Buffer }]
  // Pinata expects multipart with relative paths: folderName/filename
  const boundary = '----PinataBoundary' + Date.now();
  const parts    = [];

  // pinataMetadata
  const meta = JSON.stringify({ name: folderName });
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="pinataMetadata"\r\nContent-Type: application/json\r\n\r\n${meta}\r\n`
  );

  // pinataOptions
  const opts = JSON.stringify({ wrapWithDirectory: true });
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="pinataOptions"\r\nContent-Type: application/json\r\n\r\n${opts}\r\n`
  );

  // Files
  const binaryParts = [];
  for (const f of files) {
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${folderName}/${f.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
    binaryParts.push(Buffer.from(header));
    binaryParts.push(f.data);
    binaryParts.push(Buffer.from('\r\n'));
  }
  const closing = Buffer.from(`--${boundary}--\r\n`);

  const headersBuf  = Buffer.from(parts.join(''));
  const body        = Buffer.concat([headersBuf, ...binaryParts, closing]);

  const res = await fetch(PIN_URL, {
    method:  'POST',
    headers: {
      'Content-Type':         `multipart/form-data; boundary=${boundary}`,
      'Content-Length':       body.length,
      'Authorization': `Bearer ${PINATA_JWT}`,
    },
    body,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Pinata error ${res.status}: ${txt}`);
  }
  const json = await res.json();
  return json.IpfsHash;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Read PNG files
  const pngFiles = fs.readdirSync(imagesDir)
    .filter(f => f.toLowerCase().endsWith('.png'))
    .sort((a, b) => parseInt(a) - parseInt(b));

  if (pngFiles.length === 0) {
    console.error('No PNG files found in', imagesDir);
    process.exit(1);
  }

  console.log(`Found ${pngFiles.length} PNG files`);
  console.log('');

  // 2. Upload images
  console.log('Step 1/2: Uploading images to Pinata…');
  const imageFiles = pngFiles.map(f => ({
    name: f,
    data: fs.readFileSync(path.join(imagesDir, f)),
  }));

  const imageCID = await uploadFolder(imageFiles, 'milady-images');
  console.log(`✓ Images CID: ${imageCID}`);
  console.log(`  Preview: https://gateway.pinata.cloud/ipfs/${imageCID}/${pngFiles[0]}`);
  console.log('');

  // 3. Generate metadata JSONs in memory
  console.log('Step 2/2: Generating & uploading metadata…');
  const firstIndex = parseInt(pngFiles[0]);
  const metaFiles  = [];

  for (let tokenId = 0; tokenId < pngFiles.length; tokenId++) {
    const srcFilename = pngFiles[tokenId]; // e.g. "1.png" or "0.png"
    const metadata    = {
      name:        `${COLLECTION_NAME} #${tokenId}`,
      description: DESCRIPTION,
      image:       `ipfs://${imageCID}/${srcFilename}`,
      attributes:  [],
    };
    metaFiles.push({
      name: `${tokenId}.json`,
      data: Buffer.from(JSON.stringify(metadata)),
    });
  }

  const metaCID = await uploadFolder(metaFiles, 'milady-metadata');
  console.log(`✓ Metadata CID: ${metaCID}`);
  console.log(`  Preview: https://gateway.pinata.cloud/ipfs/${metaCID}/0.json`);
  console.log('');

  // 4. Save CIDs to file
  const result = { imageCID, metaCID, baseURI: `ipfs://${metaCID}/` };
  fs.writeFileSync('./milady-cids.json', JSON.stringify(result, null, 2));
  console.log('CIDs saved to milady-cids.json');
  console.log('');
  console.log('=== Deploy command ===');
  console.log(`MILADY_BASE_URI=ipfs://${metaCID}/ npx hardhat run deploy/03_deploy_milady.js --network bittensor`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
