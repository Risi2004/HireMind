const { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
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

/**
 * Deletes an avatar object from the Cloudflare R2 bucket.
 * Handles API URLs, raw filenames, S3 keys, and safely ignores data URIs or third-party URLs.
 *
 * @param {string} keyOrUrl - S3 object key or API stream URL (e.g. 'avatars/filename.jpg' or '/api/auth/avatar/filename.jpg')
 */
const deleteAvatar = async (keyOrUrl) => {
  if (!keyOrUrl || typeof keyOrUrl !== 'string') {
    return;
  }

  // If it's a data URI or blob URL (e.g. dev fallback), no cloud file to delete
  if (keyOrUrl.startsWith('data:') || keyOrUrl.startsWith('blob:')) {
    return;
  }

  // If it's an external third-party URL (e.g. GitHub CDN, Unsplash) and doesn't belong to our bucket/proxy
  if ((keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) && !keyOrUrl.includes('/api/auth/avatar/')) {
    const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
    if (!accountId || !keyOrUrl.includes(accountId)) {
      return;
    }
  }

  const r2Client = getR2Client();
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

  if (!r2Client || !bucketName) {
    console.log('[Storage] Cloud storage not configured, skipping remote avatar purge');
    return;
  }

  // Parse clean object key from URL or filename
  let cleanKey = keyOrUrl.trim();
  if (cleanKey.includes('/api/auth/avatar/')) {
    const filename = cleanKey.split('/api/auth/avatar/')[1].split('?')[0].split('#')[0];
    cleanKey = `avatars/${filename}`;
  } else if (cleanKey.startsWith('avatars/')) {
    cleanKey = cleanKey.split('?')[0].split('#')[0];
  } else {
    // Pure filename or relative path
    const filename = path.basename(cleanKey.split('?')[0].split('#')[0]);
    cleanKey = `avatars/${filename}`;
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: cleanKey,
    });
    await r2Client.send(command);
    console.log(`[Storage] Successfully purged candidate profile picture: ${cleanKey}`);
  } catch (err) {
    console.warn(`[Storage] Failed to purge profile picture ${cleanKey}:`, err.message);
  }
};

/**
 * Uploads a resume/CV (PDF, DOCX) to the private Cloudflare R2 bucket.
 *
 * @param {Buffer} fileBuffer - In-memory file buffer from Multer
 * @param {string} originalFilename - Original uploaded filename
 * @param {string} mimetype - File MIME type (e.g. 'application/pdf')
 * @returns {Promise<{ key: string, filename: string, originalFilename: string, resumeUrl: string }>}
 */
const uploadResume = async (fileBuffer, originalFilename, mimetype) => {
  const r2Client = getR2Client();
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

  if (!r2Client || !bucketName) {
    throw new Error('Cloudflare R2 client is not configured');
  }

  const extension = path.extname(originalFilename).toLowerCase() || '.pdf';
  const uniqueFilename = `resume-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extension}`;
  const key = `resumes/${uniqueFilename}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: mimetype || 'application/pdf',
  });

  await r2Client.send(command);

  return {
    key,
    filename: uniqueFilename,
    originalFilename,
    resumeUrl: `/api/profile/resume/${uniqueFilename}`,
  };
};

/**
 * Retrieves a resume stream from the private Cloudflare R2 bucket.
 *
 * @param {string} key - Object key (e.g. 'resumes/resume-123.pdf')
 * @returns {Promise<{ Body: ReadableStream, ContentType: string, ContentLength: number }>}
 */
const getPrivateResumeStream = async (key) => {
  const r2Client = getR2Client();
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

  if (!r2Client || !bucketName) {
    throw new Error('Cloudflare R2 client is not configured');
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const response = await r2Client.send(command);
  return {
    Body: response.Body,
    ContentType: response.ContentType || 'application/pdf',
    ContentLength: response.ContentLength,
  };
};

/**
 * Deletes a resume object from the Cloudflare R2 bucket.
 *
 * @param {string} keyOrUrl - S3 object key or API stream URL (e.g. 'resumes/resume-123.pdf' or '/api/profile/resume/resume-123.pdf')
 */
const deleteResume = async (keyOrUrl) => {
  if (!keyOrUrl || typeof keyOrUrl !== 'string') {
    return;
  }

  if (keyOrUrl.startsWith('data:') || keyOrUrl.startsWith('blob:')) {
    return;
  }

  if ((keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) && !keyOrUrl.includes('/api/profile/resume/')) {
    const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
    if (!accountId || !keyOrUrl.includes(accountId)) {
      return;
    }
  }

  const r2Client = getR2Client();
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

  if (!r2Client || !bucketName) {
    console.log('[Storage] Cloud storage not configured, skipping remote resume purge');
    return;
  }

  // Parse clean object key from URL or filename
  let cleanKey = keyOrUrl.trim();
  if (cleanKey.includes('/api/profile/resume/')) {
    const filename = cleanKey.split('/api/profile/resume/')[1].split('?')[0].split('#')[0];
    cleanKey = `resumes/${filename}`;
  } else if (cleanKey.startsWith('resumes/')) {
    cleanKey = cleanKey.split('?')[0].split('#')[0];
  } else {
    const filename = path.basename(cleanKey.split('?')[0].split('#')[0]);
    cleanKey = `resumes/${filename}`;
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: cleanKey,
    });
    await r2Client.send(command);
    console.log(`[Storage] Successfully purged resume: ${cleanKey}`);
  } catch (err) {
    console.warn(`[Storage] Failed to purge resume ${cleanKey}:`, err.message);
  }
};

module.exports = {
  uploadProfilePicture,
  getPrivateAvatarStream,
  getPresignedAvatarUrl,
  checkR2Connection,
  deleteAvatar,
  uploadResume,
  getPrivateResumeStream,
  deleteResume,
};


