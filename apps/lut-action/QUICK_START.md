# Quick Start Guide - Frame.io LUT Action Service

Get the LUT Action service running in 5 minutes! No Redis or BullMQ needed - simplified synchronous processing.

## Prerequisites Checklist

- [ ] Node.js 20+ installed (`node --version`)
- [ ] FFmpeg installed (`ffmpeg -version`)
- [ ] ngrok installed (`ngrok version`)
- [ ] Frame.io account with Custom Actions API access
- [ ] LUT files (.cube format) ready to import

## Current Configuration

Your ngrok URL: `https://1df3e78a0240.ngrok.app`  
OAuth Redirect: `https://1df3e78a0240.ngrok.app/auth/callback`

## Step 1: Configure Environment

Update your `.env` file with current settings:

```env
# Server Configuration
PORT=8080
NODE_ENV=development

# Public URL (your ngrok URL)
PUBLIC_URL=https://1df3e78a0240.ngrok.app
WEBHOOK_URL=https://1df3e78a0240.ngrok.app

# Frame.io OAuth (from Adobe Developer Console)
FRAMEIO_CLIENT_ID=aeb79213842945cdb536c3313f854763
FRAMEIO_CLIENT_SECRET=p8e-Ih6fMt0KTcAYs8Jbt7_DGcFTv6TOr9Cd

# Webhook Security (from registration)
FRAMEIO_WEBHOOK_SECRET=9H8R5dsSgDlt9OMmeGeqi1H4kwVqBpCxkYbQGZZoh54V5GXqMUG6ZAuQEwrcSiRu

# File Processing
TMP_DIR=/tmp/archon-lut
MAX_INPUT_GB=25
FFMPEG_PATH=ffmpeg

# Logging
LOG_LEVEL=debug
LOG_PRETTY=true
```

## Step 2: Import Your LUTs

```bash
# Import LUTs from your directory (already done - 22 LUTs loaded)
npm run import:luts ~/LUTs

# Verify LUTs are loaded
curl http://localhost:8080/luts | jq '.count'
# Should return: 22
```

## Step 3: Start the Service

```bash
# No Redis needed! Just run:
npm run dev

# You should see:
# Server running on port 8080
# LUT service initialized with 22 LUTs
```

## Step 4: Verify ngrok is Running

Your current ngrok URL: `https://1df3e78a0240.ngrok.app`

```bash
# If not running, start it:
ngrok http 8080

# Make sure the URL matches your .env file
```

## Step 5: Authentication Status

The service is already authenticated with Frame.io. Token is saved in `.frameio-token`.

To re-authenticate if needed:
```bash
# Open browser
open http://localhost:8080/auth/authorize
```

## Step 6: Custom Action Registration

A custom action is already registered:
- **Action ID**: `30f92325-4822-4c83-949c-9ac9c66cea23`
- **Name**: Apply LUT
- **Webhook Secret**: Already in your .env

To register a new action:
```bash
npm run register:action
# Update FRAMEIO_WEBHOOK_SECRET in .env with the new secret
```

## Step 7: Test the Service

### Check Health
```bash
curl http://localhost:8080/health
# Expected: {"status":"healthy","timestamp":"...","version":"1.0.0"}
```

### List Available LUTs
```bash
curl http://localhost:8080/luts | jq '.luts[] | .name'
# Shows all 22 LUT names
```

### Check Recent Jobs
```bash
# Check a specific job status
curl http://localhost:8080/jobs/job_140dee0b-1c82-4e66-9f8f-10080ba2d27e | jq
```

## Step 8: Process a Video

1. **Upload a Video** to your Frame.io workspace (important: use a fresh video)
2. **Right-click** the video in Frame.io
3. **Select "Apply LUT"** from the custom actions menu
4. **Choose a LUT** from the dropdown (22 options available)
5. **Click Submit**

You'll see:
```
Your video is being processed with the selected LUT.
Job ID: job_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## Monitor Processing

Watch the server logs in your terminal:
```
[INFO] Starting job processing
[INFO] Downloading asset from Frame.io
[INFO] Applying LUT to video
[INFO] Uploading processed video to Frame.io
[INFO] Job completed successfully
```

## Current LUTs Available (22)

### Basic Corrections
- Neutral Pass-Through
- Warm Sunset
- Cool Blue
- High Contrast

### Camera LUTs
- AlexaV3 Neutral 709
- JD ARRI
- SONY VENICE NULL
- Red Helium 5219
- GR RED

### Film Emulation
- Kodak D55 Modified
- Rec709 Fujifilm 3513DI
- RED Kodak Vision 3

### Creative Looks
- IPP2 Med Contrast
- MRSM Delog New
- PANA Raptor
- DIT F55 Rock N Roll
- TAM DAY/NIGHT variations
- s709 V1

## Troubleshooting

### ❌ Asset Not Found (404)
The asset `6ec50dbc-4427-4cfe-b444-7cffa7b03ecf` no longer exists.
**Solution**: Upload a new video to Frame.io and use that instead.

### ❌ Invalid Signature
**Solution**: Re-register the custom action:
```bash
npm run register:action
# Update FRAMEIO_WEBHOOK_SECRET in .env
# Restart the server
```

### ❌ Authentication Failed
**Solution**: Re-authenticate:
```bash
rm .frameio-token
open http://localhost:8080/auth/authorize
```

### ❌ Processing Failed
Check the server logs for detailed error messages. Common issues:
- Video file too large (max 25GB)
- Unsupported video format
- Network timeout during download/upload

## What's Different from Original?

This implementation has been simplified:
- **No Redis Required**: Removed BullMQ queue system
- **No Worker Process**: Jobs process synchronously in background
- **Simpler Deployment**: Single process, no queue management
- **Same Functionality**: Full Frame.io integration works perfectly

## Quick Commands

```bash
# Development
npm run dev                    # Start server
npm run build                  # Build TypeScript

# LUT Management  
npm run import:luts ~/dir      # Import LUTs
curl localhost:8080/luts       # List LUTs

# Frame.io
npm run register:action        # Register custom action
npm run frameio:info          # Get account info

# Testing
npm run test:lut              # Test processing manually
curl localhost:8080/health    # Health check
```

## Docker Deployment (Optional)

```bash
# Build and run
docker-compose up --build

# The container includes everything needed
# No separate Redis container required
```

## Next Steps

1. **Upload a fresh video** to Frame.io for testing
2. **Try different LUTs** to see the effects
3. **Monitor job status** via the `/jobs/:id` endpoint
4. **Check Frame.io** for the processed versions

## Support

- **Server Logs**: Watch the terminal for detailed processing info
- **Frame.io Webhooks**: Check webhook logs in Frame.io dashboard
- **ngrok Inspector**: Visit http://localhost:4040
- **Job Status**: GET `/jobs/:id` for processing details

---

**Service is running and ready to process videos! 🎬**

Current Status:
- ✅ Server running on port 8080
- ✅ 22 LUTs loaded
- ✅ Custom action registered
- ✅ Authentication active
- ✅ Ready for video processing