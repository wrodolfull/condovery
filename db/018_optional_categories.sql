-- Serviços e Moda: categorias opcionais, criadas desligadas em cada condomínio.
-- ON CONFLICT preserva a decisão já tomada pelo administrador e os IDs existentes.
INSERT INTO categories(condominium_id,name,icon,sort_order,is_active)
SELECT c.id,v.name,v.icon,v.sort_order,false
FROM condominiums c CROSS JOIN (
 VALUES ('Serviços','wrench',70),('Moda','shirt',71)
) AS v(name,icon,sort_order)
ON CONFLICT(condominium_id,name) DO NOTHING;

-- Ícones consistentes, inclusive quando a categoria já existia de uma versão antiga.
UPDATE categories SET icon='wrench' WHERE name='Serviços' AND icon IS DISTINCT FROM 'wrench';
UPDATE categories SET icon='shirt' WHERE name='Moda' AND icon IS DISTINCT FROM 'shirt';
