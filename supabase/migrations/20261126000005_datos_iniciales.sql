-- Configuración inicial (una sola fila). Los valores se cambian desde la app.
insert into public.configuracion (
  cuota_social_monto,
  cuota_social_dia_vencimiento,
  precio_practica,
  precio_clase,
  precio_torneo
)
values (45000, 10, 25000, 35000, 80000)
on conflict (id) do nothing;
