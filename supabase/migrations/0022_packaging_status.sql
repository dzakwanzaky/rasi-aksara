-- Zaky, 27 Nov 2026: packaging hampir tidak mungkin dihitung manual, jadi semua packaging
-- cukup "Masih Ada Stock / Perlu Beli", sama seperti Operasional. Hitungan angka lama tetap tersimpan.
-- Admin bisa mengubah per barang di menu Bahan (centang "Tidak dihitung angka").
-- Jalankan setelah 0020. Aman dijalankan dua kali.
alter table items add column if not exists status_only boolean not null default false;
update items set status_only = true where category in ('Operasional', 'Packaging') and not status_only;
