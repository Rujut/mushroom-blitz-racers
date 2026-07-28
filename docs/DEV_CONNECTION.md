# Fix: Phone "Failed to download remote update" / Metro disconnected

This error means **Expo Go on your phone cannot download the JavaScript bundle** from your computer's Metro server. It is **not** a game bug.

## Quick fix (try in order)

### 1. Same Wi‑Fi + LAN mode

```bash
cd mushroom-blitz-racers
npm run verify:part1    # must pass first (no bundle errors)
npm run start:clear
```

- Phone and PC must be on the **same Wi‑Fi** (not guest network).
- In the terminal, press **`s`** → switch connection to **LAN**.
- Scan the QR code labeled **Expo Go** (starts with `exp://`), **not** the web `http://` link.

### 2. Tunnel (different networks / strict router)

```bash
npm run start:tunnel
```

Wait until tunnel URL appears, then scan QR in Expo Go. Slower but works through firewalls.

### 3. Android: enter URL manually

In Expo Go → **Enter URL manually**:

```
exp://YOUR_PC_IP:8081
```

Find `YOUR_PC_IP` in the terminal (e.g. `192.168.1.42`).

### 4. Firewall (Linux)

```bash
sudo ufw allow 8081/tcp
sudo ufw allow 19000:19002/tcp
```

### 5. Do not open the game in a mobile browser

Use the **Expo Go** app only. Opening `http://localhost:8081` on the phone will fail.

### 6. Update Expo Go

Install the latest **Expo Go** from Play Store / App Store (SDK 54).

---

## Web: "CanvasKit is not defined"

Fixed by project setup (`index.web.tsx` + `public/canvaskit.wasm`). After pulling changes:

```bash
npm install
npm run setup:skia-web
npm run start:clear
```

Then hard-refresh the browser (Ctrl+Shift+R).
