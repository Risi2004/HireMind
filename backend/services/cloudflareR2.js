const { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
const crypto = require('crypto');

// Initialize S3 client configured for private Cloudflare R2
const getR2Client = () => {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
};

/**
 * Verifies connection and access to the private Cloudflare R2 bucket at startup.
 */
const checkR2Connection = async () => {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    console.log('[Cloudflare R2] Credentials not configured in .env (Mock/Data-URI fallback enabled)');
    return false;
  }

  try {
    const client = getR2Client();
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`[Cloudflare R2] Connected: Private bucket "${bucketName}" verified successfully`);
    return true;
  } catch (error) {
    console.warn(`[Cloudflare R2] Connection notice: ${error.message || 'Unable to access bucket'}`);
    return false;
  }
};


/**
 * Uploads a profile picture buffer to a PRIVATE Cloudflare R2 bucket.
 * Falls back safely to a Base64 data URL in development if R2 credentials are not set.
 *
 * @param {Express.Multer.File} file
 * @returns {Promise<string>} Secure proxy URL to stream avatar from private R2
 */
const uploadProfilePicture = async (file) => {
  if (!file) return '';

  const r2Client = getR2Client();
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

  // Fallback if Cloudflare R2 credentials are not yet configured in .env
  if (!r2Client || !bucketName) {
    console.warn('[Cloudflare R2] Credentials not fully set in .env. Using data-URI fallback for development.');
    return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  }

  const ext = path.extname(file.originalname) || '.jpg';
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  const uniqueKey = `avatars/${filename}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: uniqueKey,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await r2Client.send(command);

  // Return the private backend streaming endpoint
  // The bucket remains 100% private with no public access allowed.
  return `/api/auth/avatar/${filename}`;
};

/**
 * Streams a private avatar directly from Cloudflare R2.
 *
 * @param {string} key - S3 object key (e.g. 'avatars/123.jpg')
 * @returns {Promise<{ Body: NodeJS.ReadableStream, ContentType: string } | null>}
 */
const getPrivateAvatarStream = async (key) => {
  const r2Client = getR2Client();
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

  if (!r2Client || !bucketName) {
    return null;
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const response = await r2Client.send(command);
  return {
    Body: response.Body,
    ContentType: response.ContentType || 'image/jpeg',
  };
};

/**
 * Generates a temporary Presigned URL for private R2 object access.
 *
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL lifetime in seconds (default 3600 = 1 hour)
 * @returns {Promise<string>}
 */
const getPresignedAvatarUrl = async (key, expiresIn = 3600) => {
  const r2Client = getR2Client();
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

  if (!r2Client || !bucketName) {
    return '';
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return getSignedUrl(r2Client, command, { expiresIn });
};

module.exports = {
  uploadProfilePicture,
  getPrivateAvatarStream,
  getPresignedAvatarUrl,
  checkR2Connection,
};

