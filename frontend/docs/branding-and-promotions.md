# Actualización de branding y campañas en pantallas de sala

Este resumen está orientado al personal de comunicación o a quienes administran el panel de control para que puedan ajustar la identidad visual y los mensajes promocionales sin editar código.

## Encabezado de la pantalla de sala

El encabezado de la cartelería toma sus valores de la configuración general del sistema:

| Elemento | Clave de configuración | Dónde se edita |
| --- | --- | --- |
| Logo | `brandLogoUrl` | Panel de administración → Configuración → *Cartelería y branding* |
| Título principal | `displayTitle` | Misma sección |
| Nombre mostrado (opcional) | `brandDisplayName` | Misma sección (agregar el ajuste manualmente si aún no existe) |
| Eslogan | `displaySlogan` | Panel de administración → Configuración → *Cartelería y branding* |

1. Ingresá al panel de administración y abrí la sección **Cartelería y branding**.
2. Cargá la URL del logo institucional. Debe ser una imagen pública en formato PNG o SVG.
3. Definí el título que querés mostrar en la cabecera (por ejemplo, "Centro de atención" o "Sucursal Córdoba").
4. Ingresá el eslogan que querés que aparezca debajo del título. El cambio es inmediato en las pantallas.
5. Opcionalmente, podés agregar (o actualizar) la clave `brandDisplayName` desde la misma sección para modificar el nombre que aparece junto al logo.

> Consejo: utilizá imágenes de al menos 240 × 240 px para que se vean nítidas en la cabecera.

## Campañas y mensajes promocionales

La tarjeta lateral ahora funciona como un carrusel. Cuando hay campañas activas, rota entre ellas respetando la prioridad configurada; si no hay campañas, muestra mensajes de servicio predeterminados.

Para cargar campañas nuevas:

1. Ingresá al panel de administración y abrí **Comunicaciones** → **Mensajes personalizados**.
2. Creá un mensaje con tipo **`promotion`**. Podés definir título, descripción, prioridad (1 a 5), vigencia (fechas de inicio y fin) y una imagen opcional (`mediaUrl`).
3. Activá la campaña para que comience a mostrarse en la sala. Las campañas con mayor prioridad se mantienen más tiempo en pantalla.

Los mensajes promocionales también se utilizan en la sección de promociones destacadas, por lo que bastará con mantener actualizada esta lista para que ambos espacios reflejen la información correcta.

### Mensajes de respaldo

Si no hay promociones cargadas, el sistema muestra automáticamente mensajes neutros (información general, recomendaciones de uso del servicio y recordatorios). Podés personalizarlos creando campañas con prioridad baja y dejándolas activas de forma permanente.

---

Ante cualquier duda podés restablecer los valores por defecto con el botón **Restaurar branding por defecto** dentro del panel de configuración. Esto restablece colores, logo y eslogan a los valores de referencia incluidos en la aplicación.
