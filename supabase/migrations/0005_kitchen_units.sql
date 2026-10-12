-- Zaky, 12 Okt 2026: satuan dapur mengikuti cara staff menghitung (bungkus, biji, botol, dst),
-- bukan semuanya gr/ml. Ditambah Bawang Putih Halus, Nugget dan Sosis.

update items set unit = v.unit,
  min_stock = case when items.unit is distinct from v.unit then null else items.min_stock end
from (values
  (39, 'potong'), (40, 'gr'), (41, 'bungkus'), (42, 'sachet'),
  (43, 'bungkus'), (46, 'bungkus'), (47, 'bungkus'), (48, 'bungkus'), (62, 'bungkus'),
  (60, 'bungkus'), (64, 'bungkus'), (82, 'bungkus'), (80, 'bungkus'),
  (44, 'biji'), (49, 'biji'), (53, 'biji'), (51, 'biji'), (77, 'biji'),
  (50, 'bonggol'),
  (57, 'botol'), (58, 'botol'), (59, 'botol'), (61, 'botol'), (79, 'botol'),
  (84, 'pack'), (85, 'pack'), (86, 'pack'), (87, 'pack'), (88, 'pack'),
  (45, 'gr'), (66, 'gr'), (68, 'gr'), (67, 'gr'),
  (69, 'tangkai'), (70, 'lembar'),
  (71, 'gr'), (72, 'gr')
) as v(id, unit)
where items.id = v.id;

update items set name = 'Saos Raja Rasa' where id = 79 and name = 'Saos Raja';

insert into items (name, category, unit, sort_order)
select v.name, 'Dapur', v.unit, v.sort_order
from (values ('Bawang Putih Halus', 'toples', 40), ('Nugget', 'bungkus', 82), ('Sosis', 'bungkus', 82)) as v(name, unit, sort_order)
where not exists (select 1 from items i where i.name = v.name);

-- Hitungan 12 Okt: Kaldu Jamur 6 (bukan 4); Bawang Putih 250 gr + ½ toples yang halus.
do $$
declare sid uuid;
begin
  select id into sid from opname_sessions where count_date = '2026-10-12' order by created_at desc limit 1;
  if sid is null then return; end if;
  insert into opname_lines (session_id, item_id, tersedia)
  select sid, i.id, v.tersedia
  from (values ('Kaldu Jamur', '6'), ('Bawang Putih', '250 gr'), ('Bawang Putih Halus', '1/2')) as v(name, tersedia)
  join items i on i.name = v.name
  on conflict (session_id, item_id) do update set tersedia = excluded.tersedia;
end $$;
