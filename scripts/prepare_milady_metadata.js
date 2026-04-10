/**
 * Prepare TAO Milady metadata JSONs for IPFS upload
 *
 * Usage:
 *   node scripts/prepare_milady_metadata.js --input ./milady-pngs --output ./milady-metadata
 *
 * Expects: ./milady-pngs/0.png, 1.png, ... 1110.png  (or 1.png...1111.png — auto-detected)
 * Creates: ./milady-metadata/0.json, 1.json, ... 1110.json
 *          (token IDs start at 0 to match contract: first mint = token #0)
 *
 * After running:
 *   1. Upload ./milady-metadata/ folder to Pinata → get CID
 *   2. Upload ./milady-pngs/ folder to Pinata → get image CID
 *   3. MILADY_BASE_URI=ipfs://<metadata-CID>/ npx hardhat run deploy/03_deploy_milady.js --network bittensor
 */

const fs   = require('fs');
const path = require('path');

const args       = process.argv.slice(2);
const inputDir   = args[args.indexOf('--input')  + 1] || './milady-pngs';
const outputDir  = args[args.indexOf('--output') + 1] || './milady-metadata';
const imageCID   = args[args.indexOf('--imagecid') + 1] || 'REPLACE_WITH_IMAGE_CID';

const COLLECTION_NAME = 'TAO Milady';
const DESCRIPTION     = 'TAO Milady — 1111 unique NFTs on Bittensor EVM.';

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Detect if images are 0-indexed or 1-indexed
const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.png')).sort((a,b) => {
  return parseInt(a) - parseInt(b);
});

if (files.length === 0) {
  console.error(`No PNG files found in ${inputDir}`);
  process.exit(1);
}

const firstIndex = parseInt(files[0]);
const total      = files.length;

console.log(`Found ${total} PNGs (starting at index ${firstIndex})`);
console.log(`Generating metadata with token IDs 0–${total - 1}…`);

for (let tokenId = 0; tokenId < total; tokenId++) {
  const srcIndex  = firstIndex + tokenId; // image filename index
  const imageFile = `${srcIndex}.png`;
  const imagePath = path.join(inputDir, imageFile);

  if (!fs.existsSync(imagePath)) {
    console.warn(`  Missing: ${imageFile} — skipping token ${tokenId}`);
    continue;
  }

  const metadata = {
    name:        `${COLLECTION_NAME} #${tokenId}`,
    description: DESCRIPTION,
    image:       `ipfs://${imageCID}/${imageFile}`,
    attributes:  [],
  };

  fs.writeFileSync(
    path.join(outputDir, `${tokenId}.json`),
    JSON.stringify(metadata, null, 2)
  );
}

console.log(`\n✓ ${total} JSON files written to ${outputDir}/`);
console.log(`\nNext:`);
console.log(`  1. Upload ${inputDir}/ to Pinata  → replace IMAGE_CID and re-run to update images`);
console.log(`  2. Upload ${outputDir}/ to Pinata → get METADATA_CID`);
console.log(`  3. Deploy: MILADY_BASE_URI=ipfs://<METADATA_CID>/ npx hardhat run deploy/03_deploy_milady.js --network bittensor`);
