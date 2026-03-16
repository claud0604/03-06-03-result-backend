# FaceFree Result Page Backend

API server for the customer-facing result page. Serves personalized beauty analysis results and generates signed URLs for GCS images.

## Part of FaceFree Platform
See the [main README](../../README.md) for full project documentation.

## Tech Stack
- Node.js, Express.js
- Google Cloud Storage
- Google Cloud Firestore

## Setup

```bash
git clone https://github.com/claud0604/03-06-03-result-backend.git
cd 02-backend
npm install
cp .env.example .env
# Configure environment variables
node server.js
```

## Environment Variables
| Variable | Description |
|----------|-------------|
| PORT | Server port (default: 3063) |
| GCS_BUCKET | Google Cloud Storage bucket name |
| GCS_KEY_PATH | Path to service account key JSON |

## Production Deployment
Deployed on Google Compute Engine with PM2.
```bash
gcloud compute ssh apl-backend-server --zone=asia-northeast3-a
cd /home/kimvstiger/apps/result-backend/ && git pull && npm install && pm2 restart result-backend
```
