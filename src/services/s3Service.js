const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = new S3Client({ region: 'ap-south-1' });
const RAW_BUCKET = 'zoho-netcore-prod-raw-data';
const PROCESSED_BUCKET = 'zoho-netcore-prod-transformed-data';

// Helper: Convert any date -> IST Date object (UTC+5:30)
function getISTDate(date = new Date()) { 
  const tzOffsetMin = date.getTimezoneOffset();
  const utcMs = date.getTime() + tzOffsetMin * 60000;
  const istOffsetMs = 5.5 * 60 * 60000;
  return new Date(utcMs + istOffsetMs);
}

// Helper: Get Y/M/D parts using IST date
function getYMDParts(date = new Date()) {
  const istDate = getISTDate(date);
  const y = istDate.getFullYear();
  const m = String(istDate.getMonth() + 1).padStart(2, '0');
  const d = String(istDate.getDate()).padStart(2, '0');
  return { y, m, d };
}

// Helper: Converts response.Body (stream) -> string for existing bucket
async function streamToString(stream) {
  if (!stream) return '';
  if (typeof stream.transformToString === 'function') {
    return await stream.transformToString();
  }
  return await new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });
}

// Generic helper to append entry into daily data.json in a given bucket
async function appendToBucket(bucketName, messageId, leadData) {
  const now = new Date();
  const { y, m, d } = getYMDParts(now);
  const key = `leads/${y}/${m}/${d}/data.json`;

  // const newEntry = { messageId, leadData, savedAt: now.toISOString() };
  const storedLeadData = (leadData && leadData.originalData) ? leadData.originalData : leadData;
  const istNow = getISTDate(now);
  const newEntry = { messageId, leadData: storedLeadData, savedAt: istNow.toISOString() };

  let items = [];
  try {
    const getCmd = new GetObjectCommand({ Bucket: bucketName, Key: key });
    const getResp = await s3Client.send(getCmd);
    const bodyStr = await streamToString(getResp.Body);
    if (bodyStr && bodyStr.trim().length > 0) {
      const parsed = JSON.parse(bodyStr);
      if (Array.isArray(parsed)) items = parsed;
      else items = [parsed];
    }
    console.log(`ℹ️ [${bucketName}] Found existing file with ${items.length} items, will append.`);
  } catch (err) {
    const code = err?.name || err?.Code || err?.$metadata?.httpStatusCode;
    if (code === 'NoSuchKey' || code === 'NotFound' || code === 404) {
      console.log(`ℹ️ [${bucketName}] No existing data.json found — will create new one.`);
      items = [];
    } else {
      console.error(`❌ [${bucketName}] Error reading existing data.json:`, err);
      throw err;
    }
  }

  items.push(newEntry);
  const putCmd = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: JSON.stringify(items, null, 2),
    ContentType: 'application/json',
    Metadata: {
      'message-id': messageId,
      'processed-at': now.toISOString()
    }
  });
  const putResp = await s3Client.send(putCmd);
  console.log(`✅ [${bucketName}] Appended record. Path: s3://${bucketName}/${key} (items=${items.length})`);
  return { success: true, location: `s3://${bucketName}/${key}`, key, etag: putResp.ETag, count: items.length };
}

const saveToRawS3 = async (messageId, data) => {
  return await appendToBucket(RAW_BUCKET, messageId, data);
};

const saveToProcessedS3 = async (messageId, data) => {
  return await appendToBucket(PROCESSED_BUCKET, messageId, data);
};

module.exports = {
  saveToRawS3,
  saveToProcessedS3
};