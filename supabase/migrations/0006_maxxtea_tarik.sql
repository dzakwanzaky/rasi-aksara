-- Zaky, 13 Okt 2026: tambah Maxxtea Tarik (bar, per sachet).
insert into items (name, category, unit, sort_order)
select 'Maxxtea Tarik', 'Bar', 'sachet', 29
where not exists (select 1 from items where name = 'Maxxtea Tarik');
