# WebMusicWidget

WebMusicWidget is a web widget as "Now Playing" indicator for streaming over platforms like TikTok LIVE Studio, Streamlab or OBS Studio with multiple design style. It works over media hooking and multiple Node.js functions. Hosted over Cloudflare Tunnel for streaming platform that requires a TLD (Top-Level Domain) with HTTPS

![Preview](https://astear17.sino.tw/WebMusicWidget/image.png)

## Features

- **Multi-Source Support**: Captures metadata from native desktop apps (Spotify, etc.) and browsers via WebNowPlaying.
- **Low Latency**: Uses WebSockets for instantaneous UI updates.
- **Dynamic UI**: Features modern tech-grid designs, obtained from `%APPDATA%\TikTok LIVE Studio\overlay\Theme Name\source-alert\alert_background_2.png`.
- **Stream Ready**: Built-in support for Cloudflare Tunneling to meet HTTPS/TLD requirements.

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
Install the [**WebNowPlaying**](https://chromewebstore.google.com/detail/webnowplaying/jfakgfcdgpghbbefmdfjkbdlibjgnbli) extension and add a custom adapter: `ws://127.0.0.1:8974`.

---

### Streaming Platform (OBS Studio, TikTok LIVE Studio,...)
> [!NOTE]
> You have to re-enter a new link after the tunnel expire/you close the terminal window

After you run `start.bat`, wait for a few seconds for it to request for a HTTPS domain. It will automatically copy the generated link

Step 1: Click the `+` button inside the `Sources` panel.

<p align="left">
  <img src="https://github.com/user-attachments/assets/ebdf51b1-d6b7-45e1-998f-3d51b40ee01d" height="320" />
  <img src="https://github.com/user-attachments/assets/00013a14-9b31-4224-8849-d3b3a46f2812" height="320" />
</p>

---

Step 2 — Select `Browser` or `Link`


<p align="left">
  <img src="https://github.com/user-attachments/assets/5fbc2fab-7721-4f84-a1a5-8c4a2d5a919f" height="320" />
  <img src="https://github.com/user-attachments/assets/51a22148-f97d-4f9f-b33e-d78597af3138" height="320" />
</p>

---

Step 3: Paste the automatically copied tunnel URL into the browser source field.

> [!TIP]
> It is recommended to set a custom resolution by 520x140 as it was the default fixed resolution.

<p align="left">
  <img src="https://github.com/user-attachments/assets/ce66ef91-636f-44e5-973b-65415a58717d" height="320" />
  <img src="https://github.com/user-attachments/assets/88cde747-ca0b-4076-b6d9-6b6a29052c13" height="320" />
</p>



