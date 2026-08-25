MEGANXS V4.1 PROFESSIONAL
=========================

FITUR UTAMA
- Dashboard 5 KPI: Uang Masuk, Uang Keluar, Selisih, Adjustment, Transaksi.
- Tab Overview, Bank / QRIS, Category, Detail Transaksi, Adjustment.
- Filter global: pencarian, category, arus, tanggal, dan Bank / QRIS.
- Tombol Reset Filter.
- Warning otomatis jika Details tidak berhasil dibaca sebagai Bank / QRIS.
- Detail transaksi dapat diklik untuk melihat Details serta debit/credit asli.
- Pagination detail transaksi.
- Upload Excel langsung: XLSX / XLS.
- Tetap mendukung CSV / TSV / TXT dan paste langsung dari Excel.
- Sheet Excel dengan header Mega akan dideteksi otomatis.
- Export CSV dengan nilai efektif dan nilai asli untuk audit.

ATURAN BANK / QRIS
- BCA -> BCA
- BNI -> BNI
- BRI -> BRI
- MANDIRI / MDR -> MDR
- QRIS diprioritaskan: NXPAY/NXSPAY, OASIS, MINERA, STO.
- Jika Details berisi QRIS sekaligus bank, QRIS yang dipakai.

ATURAN ADJUST KEMBALI
- ADJUST KEMBALI di Debit: Debit tidak dihitung sebagai Uang Keluar dan nominal mengurangi Uang Masuk.
- ADJUST KEMBALI di Credit: Credit tidak dihitung sebagai Uang Masuk dan nominal mengurangi Uang Keluar.
- Semua adjustment tetap ditampilkan di tab Adjustment agar dapat diaudit.

FORMAT INPUT
Date Time | Details | Debit | Credit | Category

UPLOAD EXCEL
- Pilih file .xlsx atau .xls langsung dari tombol Pilih File.
- MegaNXS mencari sheet yang memiliki header Date Time, Details, Debit, Credit, Category.
- Header dapat berada dalam 30 baris pertama sheet.
