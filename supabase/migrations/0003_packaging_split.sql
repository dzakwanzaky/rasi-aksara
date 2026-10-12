-- Zaky, 12 Okt 2026: Cup 14oz, Tutup dan Sablon dihitung sendiri-sendiri;
-- Cup Hot dan Stirer Hot tidak dipakai lagi (diarsipkan supaya riwayatnya tetap ada).

update items set name = 'Cup 14oz' where id = 3;

insert into items (name, category, unit, sort_order)
select v.name, 'Packaging', 'pcs', v.sort_order
from (values ('Tutup Cup 14oz', 3), ('Sablon', 3)) as v(name, sort_order)
where not exists (select 1 from items i where i.name = v.name);

update items set active = false where id in (1, 2);
