# Dynamic Island untuk Windows

Pill hitam di tengah atas layar yang berubah ukuran dengan animasi spring, mirip Dynamic Island di iPhone.
Stack: **Electron + React + Vite + Framer Motion**.

## Fitur

- **Auto-hide**: kalau tidak dipakai, island naik dan sembunyi dari layar. Gerakkan kursor ke tepi atas, tengah layar, dan tahan sebentar (sekitar 0,3 detik) untuk memunculkannya.
- **4 slide**: Musik, Timer, Notifikasi, Notes. Geser untuk pindah slide (lihat di bawah).
- **Musik otomatis**: membaca musik dari Windows, jadi semua player yang tampil di panel media Windows ikut terbaca (Spotify, YouTube dan YouTube Music di Chrome/Edge, Windows Media Player, VLC, dll). Saat musik mulai atau lagu ganti, island muncul sendiri.
- **Timer** dengan bunyi saat selesai, island ikut muncul. **Notes** tersimpan otomatis.

## Struktur folder

```
dynamic-island/
├── package.json, vite.config.mjs, index.html
├── electron/
│   ├── main.js         # window transparan, always-on-top, tray, IPC
│   ├── preload.js      # jembatan aman main <-> React
│   ├── media.js        # menjalankan media.ps1, kirim data musik ke React (+ mode demo)
│   └── media.ps1       # membaca Windows media session (SMTC)
└── src/
    ├── main.jsx, App.jsx, styles.css
    ├── hooks/          useMedia.js, useTimer.js
    ├── lib/            layout.js (ukuran, urutan slide), format.js, beep.js
    └── components/
        ├── Island.jsx      # pill + animasi spring (INTI animasi)
        ├── Carousel.jsx    # slide yang bisa digeser
        ├── Compact.jsx     # isi pill kecil
        └── MusicSlide / TimerSlide / NotifSlide / NotesSlide .jsx
```

## Cara menjalankan dari nol

1. Install **Node.js 22 atau lebih baru** dari https://nodejs.org, lalu cek `node -v`.
2. Ekstrak zip, buka terminal di folder `dynamic-island`.
3. `npm install` (download Electron sekitar 100 MB).
4. `npm run dev` untuk mode dev (hot reload).

Mau coba tampilan musik tanpa memutar lagu? Jalankan `npm run demo`. Lagu contoh akan muncul dan tombol-tombolnya berfungsi.

Untuk keluar: `Ctrl+Alt+Q`, atau klik kanan ikon island di system tray (pojok kanan bawah, kadang di dalam panah ^). Menu tray juga punya "Tampilkan island".

## Cara pakai

| Aksi | Hasil |
|---|---|
| Kursor ke tepi atas (tengah layar) | Pill turun |
| Klik pill kecil | Membuka pill besar |
| Geser kiri/kanan (drag mouse) | Pindah slide |
| Scroll mouse / swipe 2 jari di touchpad | Pindah slide |
| Klik titik di bawah | Loncat ke slide itu |
| Klik area kosong di pill besar | Menutup |
| Kursor keluar dari pill besar | Menutup sendiri (±1,4 detik) |
| Tidak dipakai (±2,5 detik) | Naik dan sembunyi |

Island juga muncul sendiri saat musik mulai, lagu ganti, atau timer selesai. Kalau kamu sedang menyentuh island atau mengetik di Notes, island tidak akan menggeser slide-mu.

Slide Notes: klik kotaknya lalu ketik. Saat mengetik, island tidak menutup. Catatan tersimpan otomatis di folder data aplikasi.

## Mengatur tampilan dan waktu

| Yang diubah | Di mana |
|---|---|
| Kapan sembunyi, menutup, lama popup | konstanta di atas `src/App.jsx` (`AUTO_HIDE`, `COLLAPSE`, `POPUP`, `DWELL`) |
| Ukuran pill | `src/lib/layout.js` (`EXPANDED`, `COMPACT`) |
| Urutan slide | `src/lib/layout.js` (`SLIDES`) dan urutan anak di `Island.jsx` |
| Rasa animasi | `OPEN`, `CLOSE`, `VERTICAL` di `src/components/Island.jsx` |
| Warna dan tata letak | `src/styles.css` |

Soal animasi: `stiffness` besar = lebih cepat, `damping` kecil = lebih membal. Membuka dibuat sedikit membal, menutup tenang.

## Cara kerja singkat

- **Animasi halus**: window Electron berukuran tetap (520x200) dan transparan. Yang dianimasikan hanya pill di dalamnya (lebar, tinggi, radius, posisi Y). Isi pill berukuran tetap dan hanya dipotong oleh pill, tanpa blur/filter, jadi ringan. `backgroundThrottling: false` di `main.js` mencegah Chromium memperlambat animasi saat window tidak fokus.
- **Click-through**: area transparan tidak menghalangi klik ke aplikasi lain. Klik hanya ditangkap saat kursor ada di atas pill.
- **Musik**: `media.ps1` (Windows PowerShell, bawaan Windows 10/11) membaca Windows media session, sama seperti panel media saat kamu menekan tombol volume. Hasilnya dikirim sebagai JSON ke Electron, lalu ke React. Tombol prev/play/next mengirim perintah balik ke player yang sedang aktif.
- **Notes**: window island biasanya tidak bisa fokus (supaya tidak mencuri fokus dari aplikasi lain). Saat kotak Notes diklik, window dibuat bisa fokus sementara, lalu dikembalikan.

## Keterbatasan

- **Notifikasi**: isi slide Notifikasi saat ini masih **data contoh**, belum terhubung ke notifikasi Windows. Membaca notifikasi Windows sungguhan butuh aplikasi yang dipaketkan dengan identitas (package identity) dan izin `UserNotificationListener`. Itu langkah terpisah setelah aplikasinya di-bundle.
- **Musik**: hanya Windows 10 versi 1809 ke atas. Kalau Windows sendiri tidak menampilkan lagunya di panel media, island juga tidak akan melihatnya.
- **Game / aplikasi fullscreen eksklusif** menutupi semua overlay. Pakai borderless windowed.

## Masalah umum

- **Musik tidak terdeteksi**
  1. Cek dulu dengan `npm run demo`. Kalau tampilan demo jalan, masalahnya di pembacaan Windows, bukan di UI.
  2. Tekan tombol volume di keyboard: apakah Windows menampilkan judul lagunya? Kalau tidak, island juga tidak bisa.
  3. Jalankan helper sendiri di terminal: `powershell -NoProfile -ExecutionPolicy Bypass -File electron\media.ps1`, lalu putar lagu. Seharusnya muncul baris JSON. Kalau ada pesan error, itu petunjuknya.
  4. Komputer kantor/kampus kadang memblokir PowerShell lewat kebijakan sistem.
- **Cover album kosong**: beberapa player tidak mengirim cover. Island memakai gradien sebagai gantinya.
- **Posisi geser setelah sleep atau ganti monitor**: sudah ditangani lewat `powerMonitor` dan event `screen` di `main.js`.
- **`npm install` gagal download Electron**: cek koneksi atau VPN, lalu ulangi.

## Build installer (PonycatSetup.exe)

1. Taruh ikon di folder `build/`: `icon.ico` (installer dan shortcut) dan `icon.png` (ikon tray, disalin ke resources lewat `extraResources`).
2. `npm install` lalu `npm run dist`.
3. Hasilnya `release/PonycatSetup.exe`. Upload file itu ke **GitHub Releases**, jangan di-commit ke repo (`release/` sudah di `.gitignore`).

Konfigurasi installer ada di bagian `"build"` di `package.json`. Skrip PowerShell (`electron/*.ps1`) otomatis dikeluarkan dari asar lewat `asarUnpack`.

## Jalan otomatis saat Windows menyala

Build terpasang mendaftarkan dirinya ke startup Windows (seperti Laragon), jadi notch aktif sendiri setelah login. Cara kerjanya:

- `app.setLoginItemSettings` di `electron/main.js` (hanya untuk build terpasang, tidak aktif saat `npm run dev`). Default aktif; matikan lewat menu tray: **Jalankan saat Windows menyala**.
- Saat dibuka otomatis, app menunggu desktop siap dulu (jeda singkat + cek layar), mencoba membuat ikon tray berulang kali sampai taskbar siap, menunda helper PowerShell beberapa detik, dan memposisikan ulang window beberapa kali karena resolusi sering baru stabil setelah boot.
- Helper musik dan notifikasi yang gagal saat boot dijalankan ulang dengan jeda makin panjang, tidak pernah berhenti permanen.

## Klik tembus dan hover

Posisi kursor dibaca langsung oleh main process (`cursorTick` di `electron/main.js`), bukan dari event mouse DOM. Klik hanya ditangkap kalau kursor tepat di atas notch; di luar notch klik selalu tembus ke aplikasi lain. Ini juga mencegah menu notch macet setelah dipakai berjam-jam.

## Warna notch mengikuti cover album

Saat lirik tampil di notch tertutup, dan di slide Musik, latar dan teks lirik mengikuti warna dominan cover lagu (`src/lib/albumArt.js`, `src/hooks/useAlbumTint.js`). Kalau cover tidak terbaca, notch tetap hitam.

## Langkah berikutnya

- **Notifikasi sungguhan**: lihat bagian Keterbatasan.
- **Tanda tangan digital (code signing)** untuk installer, supaya Windows Security tidak memblokir `PonycatSetup.exe` dan uninstaller-nya.
