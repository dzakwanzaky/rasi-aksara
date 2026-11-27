-- Tambahan 27 Nov 2026: Stella Teh Keraton sebagai barang Operasional (Masih Ada Stock / Perlu Beli).
-- Jalankan SETELAH 0020_barang_operasional.sql. Aman dijalankan dua kali.
insert into items (name, category, unit, sort_order)
select 'Stella Teh Keraton', 'Operasional', 'status', 7
where not exists (select 1 from items where name = 'Stella Teh Keraton' and active);
