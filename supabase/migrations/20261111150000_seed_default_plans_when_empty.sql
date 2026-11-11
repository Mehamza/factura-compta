insert into public.plans (
  name,
  description,
  price_year,
  duration,
  active,
  display_order
)
select defaults.name,
       defaults.description,
       defaults.price_year,
       defaults.duration,
       true,
       defaults.display_order
from (
  values
    ('Essai', 'Essai gratuit 15 jours', 0::numeric, 'annuel', 1),
    ('Accès limité', 'Fonctionnalités de base pour démarrer', 99::numeric, 'annuel', 2),
    ('PME Standard', 'Fonctionnalités essentielles pour PME', 299::numeric, 'annuel', 3),
    ('PME Pro', 'Fonctionnalités avancées et support prioritaire', 599::numeric, 'annuel', 4)
) as defaults(name, description, price_year, duration, display_order)
where not exists (select 1 from public.plans);
