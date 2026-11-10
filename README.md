# 🐱 Ponycat

**A cute Dynamic Island for Windows.**

Ponycat adalah aplikasi desktop Windows yang menghadirkan pengalaman Dynamic Island seperti iPhone dalam bentuk notch interaktif yang minimalis, modern, dan menggemaskan.

## ✨ Features

- **Dynamic Notch** — Animasi smooth dengan efek spring.
- **Music Player** — Mendeteksi musik yang sedang diputar di Windows secara otomatis.
- **Live Lyrics** — Menampilkan lirik lagu yang sedang diputar.
- **Auto Hide** — Notch otomatis bersembunyi ketika tidak digunakan.
- **Notifications** — Panel notifikasi.
- **Timer** — Timer dengan notifikasi suara.
- **Quick Notes** — Catatan sederhana dengan penyimpanan otomatis.
- **Windows Startup** — Otomatis aktif ketika Windows dinyalakan.
- **System Tray** — Kontrol aplikasi melalui system tray.

## 🛠️ Built With

- Electron
- React
- Vite
- Framer Motion
- JavaScript
- PowerShell

## 📥 Installation

1. Download **PonycatSetup.exe** dari [GitHub Releases](https://github.com/meallya/Ponycat/releases).
2. Jalankan installer.
3. Selesaikan proses instalasi.
4. Buka Ponycat dan nikmati Dynamic Island di desktop Windows kamu!

## ⌨️ Shortcuts & Controls

| Action | Result |
|---|---|
| Hover at top center | Show notch |
| Click compact notch | Expand notch |
| Drag left / right | Switch slides |
| Scroll | Switch slides |
| Click outside | Hide expanded notch |
| `Ctrl + Alt + Q` | Quit Ponycat |

## ⚙️ Development

Requirements:
- Node.js 22+
- npm

Run locally:

```bash
npm install
npm run dev
```

Run music demo:

```bash
npm run demo
```

Build Windows installer:

```bash
npm run dist
```

## 📝 Notes

- Designed for Windows 10 (1809+) and Windows 11.
- Music detection uses Windows System Media Transport Controls (SMTC).
- Some features may depend on Windows version and media player support.
- Windows notifications are currently using sample data.

## 💗 About

Ponycat is a personal desktop project created to make Windows feel a little more fun, interactive, and adorable.

**Made with love. Made for Windows. 🐱**
