# WebMusicWidget

WebMusicWidget is a professional media overlay for live streamers. It captures real-time playback data from Windows Media Sessions and web browsers to display a high-performance, tech-styled widget on platforms like TikTok LIVE Studio and OBS.

![Preview](preview.png)

## Features

- **Multi-Source Support**: Captures metadata from native desktop apps (Spotify, etc.) and browsers via WebNowPlaying.
- **Low Latency**: Uses WebSockets for instantaneous UI updates.
- **Dynamic UI**: Features a modern tech-grid design with album art, marquee text, and VU meters.
- **Stream Ready**: Built-in support for Cloudflare Tunneling to meet HTTPS requirements.

## Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Compile Native Adapter**:
   ```bash
   compile.bat
   ```
3. **Run Server**:
   ```bash
   start.bat
   ```

The overlay will be accessible at `http://localhost:8080`.

## Integration

### Browser Support
Install the **WebNowPlaying** extension and add a custom adapter: `ws://127.0.0.1:8974`.

### TikTok LIVE Studio
Use Cloudflare Tunnel to generate an HTTPS link:
```bash
cloudflared tunnel --url http://localhost:8080
```
Add the generated URL as a **Browser Source** in your streaming software.
