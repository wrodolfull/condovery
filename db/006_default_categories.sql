-- Populate new standard categories for all existing condominiums.
-- Existing product/category IDs are preserved; custom categories are untouched.
-- "Todos" is a frontend filter, not a category stored in PostgreSQL.
WITH defaults(name,icon,sort_order) AS (
  VALUES
    ('Bolos e doces','cake-slice',0),
    ('Pães e salgados','sandwich',1),
    ('Refeições','utensils',2),
    ('Bebidas','coffee',3),
    ('Lanches','pizza',4),
    ('Sobremesas e sorvetes','ice-cream-cone',5),
    ('Mercadinho','shopping-basket',6),
    ('Serviços','wrench',7),
    ('Beleza','sparkles',8),
    ('Saúde e bem-estar','heart-pulse',9),
    ('Moda','shirt',10),
    ('Casa e decoração','house',11),
    ('Eletrônicos','smartphone',12),
    ('Presentes','gift',13),
    ('Outros','shopping-bag',14)
)
INSERT INTO categories(condominium_id,name,icon,sort_order)
SELECT c.id,d.name,d.icon,d.sort_order
FROM condominiums c CROSS JOIN defaults d
ON CONFLICT(condominium_id,name) DO NOTHING;

-- Preserve user ordering unless the category still has its original
-- bootstrap position. Keep "Outros" last among factory defaults.
WITH legacy(name,old_sort,new_sort) AS (
 VALUES ('Beleza',4,8),('Moda',5,10),('Presentes',6,13),('Outros',7,14)
)
UPDATE categories c SET sort_order=l.new_sort
FROM legacy l WHERE c.name=l.name AND c.sort_order=l.old_sort;
