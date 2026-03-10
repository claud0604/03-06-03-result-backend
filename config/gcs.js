/**
 * Google Cloud Storage Client Configuration
 */
const { Storage } = require('@google-cloud/storage');

const storage = new Storage({
    projectId: process.env.GCS_PROJECT_ID,
    keyFilename: process.env.GCS_KEY_FILE
});

const GCS_CONFIG = {
    bucket: process.env.GCS_BUCKET,
    viewExpires: parseInt(process.env.SIGNED_URL_VIEW_EXPIRES) || 3600
};

const bucket = storage.bucket(GCS_CONFIG.bucket);

module.exports = { storage, bucket, GCS_CONFIG };
