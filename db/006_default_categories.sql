-- Populate food categories for all condominiums without touching existing IDs.
-- "Todos" is a frontend filter, not a database category.
WITH defaults(name,icon,sort_order) AS (
  VALUES
    ('Bolos e doces','cake-slice',0),
    ('Pães e salgados','sandwich',1),
    ('Refeições','utensils',2),
    ('Bebidas','coffee',3),
    ('Lanches','pizza',4),
    ('Sobremesas e sorvetes','ice-cream-cone',5),
    ('Mercadinho','shopping-basket',6)
)
INSERT INTO categories(condominium_id,name,icon,sort_order)
SELECT c.id,d.name,d.icon,d.sort_order
FROM condominiums c CROSS JOIN defaults d
ON CONFLICT(condominium_id,name) DO NOTHING;
