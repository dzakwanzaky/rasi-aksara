-- Zaky, 12 Okt 2026: satuan dipecah sampai ml dan gr, ayam dihitung per potong,
-- Donat, Puding dan Sourdough tidak dipakai lagi (diarsipkan supaya riwayatnya tetap ada).

-- Min stok lama ditulis dalam satuan lama (botol, pack, kg), jadi dikosongkan
-- untuk bahan yang satuannya berubah. Isi ulang di halaman Bahan.
update items set unit = v.unit,
  min_stock = case when items.unit is distinct from v.unit then null else items.min_stock end
from (values
  (5, 'ml'), (6, 'gr'), (7, 'gr'), (8, 'gr'), (9, 'gr'), (10, 'ml'), (11, 'gr'), (12, 'gr'),
  (14, 'gr'), (15, 'gr'), (16, 'gr'), (17, 'ml'), (18, 'ml'), (19, 'ml'), (20, 'gr'),
  (21, 'ml'), (22, 'ml'), (23, 'ml'), (24, 'ml'), (25, 'ml'), (28, 'gr'), (29, 'gr'),
  (30, 'gr'), (31, 'gr'), (32, 'gr'), (33, 'ml'), (34, 'ml'), (35, 'ml'), (36, 'ml'),
  (37, 'ml'), (38, 'gr'),
  (39, 'potong'), (40, 'gr'), (41, 'gr'), (42, 'gr'), (43, 'gr'), (44, 'butir'), (45, 'gr'),
  (46, 'gr'), (47, 'ml'), (48, 'gr'), (49, 'gr'), (50, 'gr'), (51, 'gr'), (52, 'gr'),
  (53, 'gr'), (54, 'gr'), (55, 'gr'), (56, 'gr'), (57, 'ml'), (58, 'ml'), (59, 'ml'),
  (60, 'ml'), (61, 'ml'), (62, 'gr'), (63, 'gr'), (64, 'gr'), (65, 'gr'), (66, 'gr'),
  (67, 'gr'), (68, 'gr'), (69, 'gr'), (70, 'gr'), (71, 'gr'), (72, 'gr'), (73, 'gr'),
  (74, 'gr'), (75, 'gr'), (76, 'gr'), (77, 'gr'), (78, 'gr'), (79, 'ml'), (80, 'gr'),
  (81, 'gr'), (82, 'gr'), (83, 'gr'), (84, 'pcs'), (85, 'pcs'), (86, 'pcs'), (87, 'pcs'),
  (88, 'pcs')
) as v(id, unit)
where items.id = v.id;

-- Kemasan tidak perlu lagi kalau satuannya sudah gr/ml.
update items set pack_size = null, pack_unit = 'gr' where unit in ('gr', 'ml');

update items set active = false where id in (89, 90, 91);
