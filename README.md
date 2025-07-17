# Real-time Collaborative Whiteboard Application

A full-stack real-time collaborative application with whiteboard drawing, chat messaging, and file sharing capabilities.

## Features

### Whiteboard (Left Panel)
- Real-time drawing synchronization across multiple users
- Drawing tools: pen, eraser with customizable colors and brush sizes
- Clear canvas functionality
- Persistent drawing storage

### Chat (Right Panel)
- Real-time messaging between users
- File upload and sharing (images, PDFs, documents)
- User presence indicators
- File previews for images
- Secure file download links

### File Handling
- Upload to Google Cloud Storage
- Secure file URLs with proper access control
- Support for common file types
- File metadata storage in Firestore

## Technology Stack

### Frontend
- **Framework**: Next.js 14 with TypeScript
- **UI Components**: shadcn/ui with Tailwind CSS
- **Real-time**: WebSocket connections
- **State Management**: React hooks

### Backend
- **Framework**: Python FastAPI
- **Real-time**: WebSocket support
- **Database**: Google Cloud Firestore
- **File Storage**: Google Cloud Storage
- **Deployment**: Google Cloud Run

## Development Setup

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+
- Google Cloud SDK
- Google Cloud Project with enabled APIs:
  - Cloud Run API
  - Cloud Storage API
  - Firestore API

### Backend Setup

1. **Clone and navigate to backend directory**
\`\`\`bash
cd backend
\`\`\`

2. **Install Python dependencies**
\`\`\`bash
pip install -r requirements.txt
\`\`\`

3. **Set up Google Cloud credentials**
\`\`\`bash
# Create service account and download key
gcloud iam service-accounts create collaborative-app-sa
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:collaborative-app-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.admin"
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:collaborative-app-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/datastore.user"

# Download service account key
gcloud iam service-accounts keys create service-account-key.json \
    --iam-account=collaborative-app-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com
\`\`\`

4. **Configure environment variables**
\`\`\`bash
cp .env.example .env
# Edit .env with your project details
\`\`\`

5. **Create Google Cloud Storage bucket**
\`\`\`bash
gsutil mb gs://collaborative-app-files-YOUR_PROJECT_ID
\`\`\`

6. **Run backend locally**
\`\`\`bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
\`\`\`

### Frontend Setup

1. **Install dependencies**
\`\`\`bash
npm install
\`\`\`

2. **Configure environment variables**
\`\`\`bash
cp .env.local.example .env.local
# Edit .env.local with your backend URLs
\`\`\`

3. **Run frontend locally**
\`\`\`bash
npm run dev
\`\`\`

## Deployment

### Backend Deployment (Google Cloud Run)

1. **Build and deploy using Cloud Build**
\`\`\`bash
cd backend
gcloud builds submit --config cloudbuild.yaml
\`\`\`

2. **Or deploy manually**
\`\`\`bash
# Build container
docker build -t gcr.io/YOUR_PROJECT_ID/collaborative-backend .

# Push to Container Registry
docker push gcr.io/YOUR_PROJECT_ID/collaborative-backend

# Deploy to Cloud Run
gcloud run deploy collaborative-backend \
    --image gcr.io/YOUR_PROJECT_ID/collaborative-backend \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GCS_BUCKET_NAME=collaborative-app-files-YOUR_PROJECT_ID
\`\`\`

### Frontend Deployment (Vercel)

1. **Deploy to Vercel**
\`\`\`bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
\`\`\`

2. **Configure environment variables in Vercel dashboard**
- `NEXT_PUBLIC_API_URL`: Your Cloud Run backend URL
- `NEXT_PUBLIC_WS_URL`: Your Cloud Run WebSocket URL (replace https with wss)

## Configuration

### CORS Configuration
Update the CORS settings in `backend/main.py` for production:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend-domain.vercel.app"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
