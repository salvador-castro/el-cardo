-- Camiseta habitual del equipo (se elige al armarlo). Cada partido puede usar otra (partidos.color_a/color_b).
alter table public.equipos
  add column color text,
  add constraint equipos_color_valido check (
    color is null or color in ('blanco', 'azul', 'celeste', 'rojo', 'bordo', 'verde', 'amarillo', 'naranja', 'negro', 'gris')
  );
