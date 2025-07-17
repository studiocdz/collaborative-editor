# Local Development Setup

## Quick Start (5 minutes)

### 1. Frontend Setup
\`\`\`bash
# Install dependencies
npm install

# Create environment file
cp .env.local .env.local

# Start frontend
npm run dev
\`\`\`

### 2. Simple Backend Setup (Python)
\`\`\`bash
# Navigate to backend
cd backend

# Install simple requirements
pip install websockets

# Run simple WebSocket server
python simple_server.py
\`\`\`

### 3. Test the Application
1. Open http://localhost:3000 in multiple browser tabs
2. Start drawing on the whiteboard
3. Send messages in the chat
4. Upload files (will work locally with mock URLs)

## What Works Locally

✅ **Real-time drawing synchronization**
✅ **Multi-user chat messaging** 
✅ **User presence indicators**
✅ **File upload (with local URLs)**
✅ **Canvas clearing**
✅ **Multiple browser tabs/windows**

## Troubleshooting

### WebSocket Connection Issues
- Make sure the Python server is running on port 8000
- Check browser console for connection errors
- Verify .env.local file exists with correct URLs

### Drawing Not Syncing
- Open browser developer tools
- Check WebSocket connection status
- Try refreshing both browser tabs

### File Upload Issues
- Files will use local blob URLs for development
- This is normal and expected for local testing
- Production deployment will use Google Cloud Storage

## Development Workflow

1. **Start Backend**: `python backend/simple_server.py`
2. **Start Frontend**: `npm run dev`
3. **Open Multiple Tabs**: Test collaboration features
4. **Check Console**: Monitor WebSocket messages and errors

## Next Steps

Once local development is working:
1. Deploy backend to Google Cloud Run
2. Deploy frontend to Vercel
3. Configure production environment variables
4. Test with real Google Cloud Storage
