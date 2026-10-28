-- Seed the optional category catalog without overwriting existing administrator choices.
-- Existing category IDs and products are preserved across repeated migrations.
INSERT INTO public.categories(condominium_id,name,icon,sort_order,is_active)
SELECT c.id,v.name,v.icon,v.sort_order,false
FROM public.condominiums c CROSS JOIN (VALUES
  ('Beleza','sparkles',60),
  ('Saúde e bem-estar','heart-pulse',61),
  ('Casa e decoração','house',62),
  ('Eletrônicos','smartphone',63),
  ('Presentes','gift',64),
  ('Outros','shopping-bag',65),
  ('Serviços','wrench',70),
  ('Moda','shirt',71),
  ('Desapego','gift',72)
) AS v(name,icon,sort_order)
ON CONFLICT(condominium_id,name) DO NOTHING;

-- Correct visual identity for known categories, without touching is_active.
UPDATE public.categories AS c SET icon=v.icon
FROM (VALUES
 ('Beleza','sparkles'),('Saúde e bem-estar','heart-pulse'),
 ('Casa e decoração','house'),('Eletrônicos','smartphone'),
 ('Presentes','gift'),('Outros','shopping-bag'),('Serviços','wrench'),
 ('Moda','shirt'),('Desapego','gift')
) AS v(name,icon)
WHERE c.name=v.name AND c.icon IS DISTINCT FROM v.icon;
