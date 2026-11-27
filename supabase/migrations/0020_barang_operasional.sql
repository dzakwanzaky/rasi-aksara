-- Zaky, 27 Nov 2026: barang operasional (sabun, pembersih, kertas nota) ikut stock opname,
-- tapi tidak dihitung jumlahnya. Staff cukup pilih "Masih Ada Stock" atau "Perlu Beli".
-- Statusnya disimpan di opname_lines.tersedia sebagai teks 'ada' / 'beli'.
-- "Perlu Beli" masuk daftar Belanja; barang ini tidak ikut angka Pemakaian.

-- Kategori jadi teks + check, supaya kategori baru bisa dipakai di file yang sama
-- (nilai enum baru tidak bisa dipakai dalam transaksi yang sama dengan penambahannya).
alter table items alter column category type text using category::text;
alter table items drop constraint if exists items_category_check;
alter table items add constraint items_category_check
  check (category in ('Packaging', 'Bar', 'Dapur', 'Operasional'));
drop type if exists item_category;

insert into items (name, category, unit, sort_order)
select v.name, 'Operasional', 'status', v.sort_order
from (values
  ('Sunlight', 1),
  ('Sabun Cuci Tangan Lifebuoy', 2),
  ('Rinso', 3),
  ('Mr Muscle', 4),
  ('Wipol', 5),
  ('Kertas Nota', 6)
) as v(name, sort_order)
where not exists (select 1 from items i where i.name = v.name and i.active);
