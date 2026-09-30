# Genba 5R Map

Peta denah interaktif untuk closing temuan Genba 5R.
Frontend statis (GitHub Pages) + Google Apps Script & Spreadsheet sebagai backend/database.

```
index.html      Aplikasi (frontend)
config.js       API_URL & Google Client ID
backend/Code.gs Backend Apps Script
```

## 1. Google Sign-In (OAuth Client ID)
1. Google Cloud Console → **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
2. *Authorized JavaScript origins*: `https://USERNAME.github.io` (dan `http://localhost:8080` untuk uji lokal).
3. Salin Client ID ke `config.js` **dan** ke konstanta `CLIENT_ID` di `backend/Code.gs` — **keduanya harus persis sama**.

## 2. Backend (Apps Script)
1. Buat Google Spreadsheet baru → **Extensions → Apps Script**, tempel `backend/Code.gs`.
2. Jalankan fungsi `setup` sekali (membuat sheet & menjadikan Anda superadmin).
3. **Deploy → New deployment → Web app** — *Execute as: Me*, *Who has access: Anyone*. Salin URL `/exec` ke `config.js` (`API_URL`).
   > Setiap ubah `Code.gs`, deploy ulang via **Manage deployments → Edit → New version**.

## 3. GitHub Pages
**Settings → Pages → Deploy from branch → main / (root)**. Aplikasi tampil di `https://USERNAME.github.io/genba-5r-map/`.

## Peran & keamanan
Hanya email yang terdaftar di sheet **Users** (atau tab Master) yang bisa masuk:
`superadmin` (kelola master), `auditor` (catat temuan), `operator` (lihat & closing).
`config.js` aman dipublikasikan (Client ID & URL API memang publik); akses dijaga verifikasi token di backend.

Uji lokal: `python3 -m http.server 8080`

## Peta & GPS
Peta memakai Leaflet + OpenStreetMap (gratis, tanpa API key; tombol layer untuk Satelit).
Superadmin merekam area dengan berjalan (Mulai → Selesai). Auditor terdeteksi otomatis di area lewat GPS;
operator melihat area ditandai merah + notifikasi saat berada di lokasi temuan. GPS wajib HTTPS (GitHub Pages sudah HTTPS).
Kolom `x`,`y` di sheet Findings = latitude,longitude. Data uji lama (denah) tidak kompatibel — hapus baris lama di sheet Areas/Findings.
