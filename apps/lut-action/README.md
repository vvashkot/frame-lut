# Frame.io LUT Action Service

A production-ready Node.js/TypeScript service that applies color grading LUTs (Look-Up Tables) to Frame.io video assets through the Frame.io Custom Actions API (v4 Experimental).

## Current Status

✅ **Fully Functional** - The service successfully:
- Integrates with Frame.io Custom Actions API (Experimental)
- Provides LUT selection form with 22 professional LUTs
- Downloads videos from Frame.io
- Applies LUTs using FFmpeg
- Uploads processed videos as new versions
- No BullMQ/Redis dependencies - simplified synchronous processing

## Features

- 🎨 **22 Professional LUTs**: Industry-standard color grading LUTs pre-loaded
- ⚡ **Synchronous Processing**: Simplified architecture without complex queue management
- 🔄 **Full Frame.io Pipeline**: Download → Process → Upload as new version
- 🔒 **Secure Webhooks**: HMAC-SHA256 signature verification (Frame.io v0 format)
- 🎬 **FFmpeg Processing**: Hardware-accelerated LUT application
- 🐳 **Docker Ready**: Single container deployment
- 📝 **Comprehensive Logging**: Structured logging with Pino

## Quick Start

### Prerequisites

- Node.js 20+
- FFmpeg with lut3d filter support
- ngrok (for local development)
- Frame.io account with Custom Actions API access

### 1. Setup Environment

```bash
# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your Frame.io credentials
```

### 2. Import LUTs

```bash
# Import LUTs from your directory (e.g., ~/LUTs)
npm run import:luts ~/LUTs

# This imported 22 LUTs successfully
```

### 3. Start Development Server

```bash
# Start the server (no Redis needed!)
npm run dev

# Server runs on http://localhost:8080
```

### 4. Setup ngrok for Webhooks

```bash
# In another terminal, start ngrok
ngrok http 8080

# Copy the HTTPS URL to PUBLIC_URL and WEBHOOK_URL in .env
# Example: https://1df3e78a0240.ngrok.app
```

### 5. Authenticate with Frame.io

```bash
# Open browser to authenticate
open http://localhost:8080/auth/authorize

# This will redirect to Adobe IMS OAuth
# Token is saved to .frameio-token
```

### 6. Register Custom Action

```bash
# Register the custom action with Frame.io
npm run register:action

# This creates a custom action in your workspace
# Save the webhook secret to .env as FRAMEIO_WEBHOOK_SECRET
```

## Architecture

```
Frame.io Custom Action → Webhook → LUT Selection Form → Synchronous Processing
                                           ↓
                                    LUT Service (22 LUTs)
                                           ↓
                                    FFmpeg Processing
                                           ↓
                                    Upload to Frame.io
```

## How It Works

1. **Trigger**: Right-click a video in Frame.io, select "Apply LUT"
2. **Select**: Choose from 22 available LUTs in the dropdown
3. **Process**: Service downloads video, applies LUT, uploads new version
4. **Complete**: New version appears in Frame.io with comment confirmation

## Available LUTs (22 Total)

### Basic Corrections
- Neutral Pass-Through
- Warm Sunset
- Cool Blue
- High Contrast

### Camera-Specific LUTs
- AlexaV3 Neutral 709
- JD ARRI
- SONY VENICE NULL
- Red Helium 5219 FilmLUT
- GR RED

### Film Emulation
- Kodak D55 Modified
- Rec709 Fujifilm 3513DI D65
- RED Kodak 7213 Vision 3

### Creative Looks
- IPP2 Med Contrast
- MRSM Delog New
- PANA Raptor LUT
- LiColor2 FILM RWG
- s709 V1

### Day/Night Looks
- TAM DAY EXT +0.0
- TAM DAY EXT -1.0
- TAM NIGHT EXT +0.0

### Professional Grading
- DIT F55 Rodrigo Rock N Roll
- DIT RockandRoll F55 OT Rec709Full

## API Endpoints

### Authentication
- `GET /auth/authorize` - Initiate OAuth flow with Adobe IMS
- `GET /auth/callback` - OAuth callback handler

### Webhooks
- `POST /webhooks/frameio/custom-action` - Frame.io custom action webhook

### LUT Management
- `GET /luts` - List all available LUTs
- `GET /luts/:id` - Get specific LUT details

### Job Status
- `GET /jobs/:id` - Check job processing status

### Health
- `GET /health` - Service health check

## Environment Variables

```env
# Server Configuration
PORT=8080
NODE_ENV=development

# Public URLs (use ngrok for local dev)
PUBLIC_URL=https://your-ngrok-url.ngrok.app
WEBHOOK_URL=https://your-ngrok-url.ngrok.app

# Frame.io OAuth (from Frame.io developer portal)
FRAMEIO_CLIENT_ID=your_client_id
FRAMEIO_CLIENT_SECRET=your_client_secret

# Webhook Security (auto-generated during registration)
FRAMEIO_WEBHOOK_SECRET=webhook_secret_from_register_action

# File Processing
TMP_DIR=/tmp/archon-lut
MAX_INPUT_GB=25
FFMPEG_PATH=ffmpeg

# Logging
LOG_LEVEL=info
LOG_PRETTY=true
```

## Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build image directly
docker build -t lut-action .
docker run -p 8080:8080 --env-file .env lut-action
```

## Project Structure

```
apps/lut-action/
├── src/
│   ├── server.ts                 # Express server
│   ├── routes/
│   │   ├── auth.ts              # OAuth endpoints
│   │   ├── webhooks.ts          # Webhook handler
│   │   ├── luts.ts              # LUT API
│   │   └── jobs.ts              # Job status API
│   ├── services/
│   │   ├── frameioService.ts    # Frame.io API client
│   │   ├── frameioProcessor.ts  # Download/upload logic
│   │   ├── simpleJobProcessor.ts # Job processing (no queues!)
│   │   └── lutService.ts        # LUT registry
│   ├── ffmpeg/
│   │   └── applyLUT.ts          # FFmpeg LUT application
│   ├── auth/
│   │   └── frameioAuth.ts       # Adobe IMS OAuth
│   └── middleware/
│       └── verifySignature.ts   # HMAC verification
├── luts/                         # LUT storage (22 .cube files)
├── scripts/
│   ├── importLUTs.ts            # Import LUTs script
│   └── registerCustomAction.ts  # Register with Frame.io
└── .frameio-token               # Cached OAuth token
```

## Troubleshooting

### Asset Not Found (404)
- The asset ID provided by Frame.io may be deleted or inaccessible
- Upload a new video to your workspace and try again
- Ensure your OAuth token has access to the workspace

### Webhook Signature Verification Failed
- Run `npm run register:action` to get a new webhook secret
- Update `FRAMEIO_WEBHOOK_SECRET` in .env with the new secret
- Restart the server to load the new secret

### LUTs Not Showing
- Run `npm run import:luts ~/YourLUTDirectory` to import LUTs
- Check that the luts/ directory contains .cube files
- Verify with `curl http://localhost:8080/luts | jq '.count'`

### OAuth Token Expired
- Delete `.frameio-token` file
- Visit `http://localhost:8080/auth/authorize` to re-authenticate
- Token will be automatically refreshed

## Development Scripts

```bash
# Development server with hot reload
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start

# Import LUTs from directory
npm run import:luts ~/LUTs

# Register Frame.io custom action
npm run register:action

# Get Frame.io account info
npm run frameio:info

# Test LUT processing manually
npm run test:lut
```

## What Was Changed from BullMQ

The service was simplified by removing BullMQ and Redis dependencies:
- **Before**: Complex queue system with BullMQ, Redis, and separate worker process
- **After**: Simple synchronous processing that runs jobs in the background
- **Benefits**: No queue management issues, simpler deployment, same functionality

## Security Considerations

- ✅ HMAC-SHA256 webhook signature verification (Frame.io v0 format)
- ✅ OAuth tokens stored securely in `.frameio-token`
- ✅ Temporary files cleaned up after processing
- ✅ Input validation with Zod schemas
- ✅ Rate limiting on API endpoints
- ✅ CORS and Helmet.js security headers

## License

MIT

## Support

For issues or questions:
- Check the logs: Server logs show detailed processing information
- Verify webhook delivery in Frame.io's webhook logs
- Ensure FFmpeg is installed: `ffmpeg -version`
- Check LUT count: `curl http://localhost:8080/luts | jq`