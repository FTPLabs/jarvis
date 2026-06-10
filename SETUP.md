# JARVIS — Setup & Installation Guide

## Quick Start

### 1. Install Ollama (Local AI)
```bash
# Windows/macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Pull the recommended model (~4GB)
ollama pull llama3:8b

# Optional: larger model for better quality (~12GB)
ollama pull gpt-oss:20b
```

### 2. Install Piper TTS (Local Voice)
```bash
# Windows: download from https://github.com/rhasspy/piper/releases
# Create voice folder
mkdir -p ~/.jarvis/voices

# Download a voice (en_US-libritts-high sounds closest to JARVIS)
curl -L "https://github.com/rhasspy/piper/releases/download/v1.2.0/voice-en_US-libritts-high.tar.gz" \
  | tar xz -C ~/.jarvis/voices/
```

### 3. Configure JARVIS
Edit `desktop/config/config.json`:
```json
{
  "ai": {
    "ollamaModel": "llama3:8b"
  },
  "analytics": {
    "youtubeApiKey": "YOUR_YOUTUBE_API_KEY",
    "youtubeChannelId": "YOUR_CHANNEL_ID",
    "tiktokUsername": "your_username"
  }
}
```

### 4. Get YouTube API Key
1. Go to https://console.cloud.google.com
2. Create a new project
3. Enable "YouTube Data API v3"
4. Create an API key
5. Paste into `config.json`

## Voice Cloning Setup

Record 5-10 seconds of your voice:
```bash
# macOS/Linux
rec -r 22050 -c 1 ~/voice_sample.wav trim 0 10

# Windows: Use Audacity or any recording app
```

Then in JARVIS Settings → Voice Cloning → upload your sample.

## Wake Word Setup (Porcupine)

1. Register free at https://picovoice.ai
2. Get your access key
3. Add to `config.json`:
   ```json
   "porcupineKey": "YOUR_KEY_HERE"
   ```

## Building from Source

### Prerequisites
- Node.js 20+
- pnpm 9+
- Python 3.11+

### Build Windows .exe
```bash
# Install dependencies
pnpm install
pip install -r desktop/requirements.txt pyinstaller

# Build everything
pnpm --filter @workspace/jarvis-ui run build
cd electron && npm install && npm run build:win
```

The installer will be at `electron/dist-app/JARVIS-Setup-*.exe`

### GitHub Releases
Tag a commit to trigger automatic builds:
```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions will build .exe, .dmg, and .AppImage automatically.

## MCP Integrations

Enable integrations in `config.json`:

```json
"mcpIntegrations": {
  "notion": {
    "enabled": true,
    "integrationToken": "secret_..."
  },
  "github": {
    "enabled": true,
    "personalAccessToken": "ghp_..."
  }
}
```

## License Key Format

- Trial (30 days): `JARVIS-XXXX-XXXX-XXXX`
- Permanent: `JARVIS-PERM-XXXX-XXXX`
- Demo: `JARVIS-DEMO-TEST-2024`

Enter your key in JARVIS → License tab.
