/**
 * Upload TAO Milady images + metadata to Filebase (IPFS)
 * Usage: node scripts/upload_milady_filebase.js --images /Users/pro/Downloads/milady --bucket my-bucket
 */

const fs   = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, HeadObjectCommand, CreateBucketCommand } = require('@aws-sdk/client-s3');

const ACCESS_KEY = '3C364C356B329D324AB3';
const SECRET_KEY = '82ZTkxw6pgiOq86RgG3ihAeIpBD5hJsqyMDZXXSu';
const ENDPOINT   = 'https://s3.filebase.com';
const REGION     = 'us-east-1';

const COLLECTION_NAME = 'TAO Milady';
const DESCRIPTION     = 'TAO Milady — 1100 unique NFTs on Bittensor EVM.';

// ── Args ──────────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const imagesDir = args[args.indexOf('--images') + 1];
const bucket    = args[args.indexOf('--bucket') + 1] || 'tao-milady';

if (!imagesDir || !fs.existsSync(imagesDir)) {
  console.error('Usage: node scripts/upload_milady_filebase.js --images /path/to/pngs [--bucket bucket-name]');
  process.exit(1);
}

const s3 = new S3Client({
  endpoint: ENDPOINT,
  region:   REGION,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  forcePathStyle: true,
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Upload a single file, returns CID from response header
async function uploadFile(key, data, contentType = 'application/octet-stream') {
  const cmd = new PutObjectCommand({
    Bucket:      bucket,
    Key:         key,
    Body:        data,
    ContentType: contentType,
  });
  const res = await s3.send(cmd);
  // CID is in x-amz-meta-cid header
  const cid = res.$metadata?.httpHeaders?.['x-amz-meta-cid']
           || res.$metadata?.extendedRequestId
           || null;
  return cid;
}

// Get CID of a folder prefix (HEAD the prefix key)
async function getFolderCID(prefix) {
  try {
    const cmd = new HeadObjectCommand({ Bucket: bucket, Key: prefix });
    const res = await s3.send(cmd);
    return res.$metadata?.httpHeaders?.['x-amz-meta-cid'] || null;
  } catch { return null; }
}

// Create bucket if not exists
async function ensureBucket() {
  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`✓ Bucket "${bucket}" created`);
  } catch (e) {
    if (e.Code === 'BucketAlreadyOwnedByYou' || e.name === 'BucketAlreadyOwnedByYou') {
      console.log(`✓ Bucket "${bucket}" exists`);
    } else if (e.Code === 'BucketAlreadyExists' || e.name === 'BucketAlreadyExists') {
      console.log(`✓ Bucket "${bucket}" exists`);
    } else {
      // Might already exist, continue
      console.log(`  Bucket check: ${e.message || e.Code}`);
    }
  }
}

async function main() {
  const pngFiles = fs.readdirSync(imagesDir)
    .filter(f => f.toLowerCase().endsWith('.png'))
    .sort((a, b) => parseInt(a) - parseInt(b));

  const total = pngFiles.length;
  console.log(`Found ${total} PNG files (${pngFiles[0]} → ${pngFiles[total-1]})`);
  console.log(`Bucket: ${bucket}`);
  console.log('');

  await ensureBucket();
  console.log('');

  // ── Step 1: Upload images ──────────────────────────────────────────────────
  console.log('Step 1/2: Uploading images…');
  const imageCIDs = {}; // filename → CID

  for (let i = 0; i < total; i++) {
    const filename = pngFiles[i];
    const key      = `images/${filename}`;
    const data     = fs.readFileSync(path.join(imagesDir, filename));

    try {
      const cid = await uploadFile(key, data, 'image/png');
      imageCIDs[filename] = cid;
      if ((i + 1) % 50 === 0 || i === total - 1) {
        console.log(`  ${i + 1}/${total} uploaded — last CID: ${cid || '(pending)'}`);
      }
    } catch (e) {
      console.error(`  ✗ ${filename}: ${e.message}`);
    }

    // Small delay every 100 files to avoid rate limiting
    if (i > 0 && i % 100 === 0) await sleep(1000);
  }

  // Get images folder CID
  await sleep(2000);
  let imagesFolderCID = await getFolderCID('images/');
  if (!imagesFolderCID) {
    // fallback: use first file's CID parent — try a known file
    console.log('  Fetching folder CID via HEAD…');
    try {
      const head = new HeadObjectCommand({ Bucket: bucket, Key: `images/${pngFiles[0]}` });
      const r    = await s3.send(head);
      imagesFolderCID = r.$metadata?.httpHeaders?.['x-amz-meta-cid'] || Object.values(imageCIDs)[0];
    } catch {}
  }

  console.log(`✓ Images uploaded. Folder CID: ${imagesFolderCID || '(check Filebase dashboard)'}`);
  console.log('');

  // ── Step 2: Generate + upload metadata ────────────────────────────────────
  console.log('Step 2/2: Uploading metadata…');

  for (let tokenId = 0; tokenId < total; tokenId++) {
    const filename    = pngFiles[tokenId];
    const individualCID = imageCIDs[filename];
    const imageURI    = individualCID
      ? `ipfs://${individualCID}`
      : `ipfs://${imagesFolderCID}/images/${filename}`;

    const metadata = {
      name:        `${COLLECTION_NAME} #${tokenId}`,
      description: DESCRIPTION,
      image:       imageURI,
      attributes:  [],
    };

    const key  = `metadata/${tokenId}.json`;
    const data = Buffer.from(JSON.stringify(metadata));

    try {
      await uploadFile(key, data, 'application/json');
      if ((tokenId + 1) % 100 === 0 || tokenId === total - 1) {
        console.log(`  ${tokenId + 1}/${total} metadata uploaded`);
      }
    } catch (e) {
      console.error(`  ✗ metadata/${tokenId}.json: ${e.message}`);
    }

    if (tokenId > 0 && tokenId % 100 === 0) await sleep(1000);
  }

  // Get metadata folder CID
  await sleep(3000);
  let metaCID = await getFolderCID('metadata/');
  if (!metaCID) {
    // Try getting CID of first metadata file
    try {
      const head = new HeadObjectCommand({ Bucket: bucket, Key: 'metadata/0.json' });
      const r    = await s3.send(head);
      metaCID    = r.$metadata?.httpHeaders?.['x-amz-meta-cid'];
    } catch {}
  }

  console.log(`✓ Metadata uploaded. Folder CID: ${metaCID || '(check Filebase dashboard)'}`);
  console.log('');

  // ── Save results ───────────────────────────────────────────────────────────
  const result = {
    bucket,
    imagesFolderCID: imagesFolderCID || 'CHECK_FILEBASE_DASHBOARD',
    metaCID:         metaCID         || 'CHECK_FILEBASE_DASHBOARD',
    baseURI:         metaCID ? `ipfs://${metaCID}/` : 'SET_AFTER_GETTING_META_CID',
    totalFiles:      total,
  };

  fs.writeFileSync('./milady-cids.json', JSON.stringify(result, null, 2));
  console.log('Saved to milady-cids.json');
  console.log('');

  if (metaCID) {
    console.log('=== Deploy command ===');
    console.log(`MILADY_BASE_URI="ipfs://${metaCID}/" npx hardhat run deploy/03_deploy_milady.js --network bittensor`);
  } else {
    console.log('→ Check Filebase dashboard for metadata/ folder CID, then:');
    console.log(`MILADY_BASE_URI="ipfs://<META_CID>/" npx hardhat run deploy/03_deploy_milady.js --network bittensor`);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
