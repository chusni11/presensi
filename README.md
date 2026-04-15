# Absensi Digital Pramuka

Sistem Absensi Digital Pramuka dengan tema Premium Glassmorphism.
Terdiri dari frontend (dihosting di GitHub Pages) dan backend (Google Apps Script).

## Panduan Instalasi (Setup)

### Tahap 1: Setup Google Apps Script & Spreadsheet
1. Buka [Google Sheets](https://sheets.google.com) dan buat Spreadsheet baru (misal dengan nama "Data Absensi Pramuka").
2. Klik menu **Ekstensi > Apps Script**.
3. Hapus semua kode bawaan di `Code.gs` dan paste semua kode yang ada di file `setup.gs` dari repository ini.
4. Simpan (Ctrl+S / Cmd+S).
5. Pada toolbar Apps Script, pilih fungsi `setupDatabase` dari dropdown, lalu klik **Jalankan** (Run).
6. Beri izin / otorisasi pada browser (Continue -> Pilih Akun Google -> Advanced -> Go to script).
7. Setelah berhasil, kembali ke Spreadsheet. Anda akan melihat sheet `Anggota`, `Absensi`, dan `Settings` sudah otomatis dibuat dan diisi data sampel.

### Tahap 2: Deploy Web App API
1. Kembali ke **Apps Script**.
2. Klik tombol **Terapkan (Deploy) > Deployment baru (New deployment)** di sudut kanan atas.
3. Pilih tipe **Web App**.
4. Isi deskripsi (opsional).
5. Eksekusi sebagai: **Saya (Me / Email Anda)**.
6. Siapa yang memiliki akses / Who has access: **Siapa saja (Anyone)**.
7. Klik **Terapkan (Deploy)**.
8. Salin **URL Aplikasi Web (Web App URL)** yang dihasilkan.

### Tahap 3: Konfigurasi Frontend
1. Buka file `js/api-config.js` di dalam proyek ini untuk sinkron database ke spreadsheet.
2. Ganti teks `AKfycbz_YOUR_SCRIPT_ID_HERE` dengan URL Aplikasi Web (Web App URL) yang baru Anda salin dari langkah sebelumnya.
   ```javascript
   const SCRIPT_URL = "https://script.google.com/macros/s/AKfy.../exec"; 
   ```

### Tahap 4: Hosting di GitHub Pages
1. Push semua file proyek ini ke repositori GitHub Anda.
2. Masuk ke **Settings** repositori Anda.
3. Pilih menu **Pages** di sebelah kiri.
4. Pada Source / Branch, pilih `main` atau `master`.
5. Klik **Save**.
6. Tunggu beberapa menit, web Anda sudah bisa diakses lewat link GitHub Pages Anda!

## Fitur-Fitur
*   **Mode Admin & Tamu**: Login Admin (password default: `pramuka123`).
*   **Scan Barcode QR**: Langsung menggunakan kamera (butuh HTTPS, seperti di github pages).
*   **Absen Manual**: Input ijin, sakit, alpa untuk anggota.
*   **Laporan Absensi**: Filter harian, mingguan, bulanan. Serta mode cetak (Print Table) yang terlihat seperti form excel resmi.
*   **Tema Glassmorphism**: Tampilan transparan dengan warna gelap (Dark Mode).

---
> Pengaruh Password Admin bisa diubah pada Spreadsheet tab `Settings` -> Ubah value `ADMIN_PASSWORD`.
