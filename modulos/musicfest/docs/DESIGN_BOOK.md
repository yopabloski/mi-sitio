# MusicFest · Design Book v1.0

## Idea rectora

**Festival por fuera. Optimización por dentro.**

MusicFest combina la energía táctil de afiches, credenciales y señalética de festivales con la claridad necesaria para comparar restricciones, costos y resultados en el aula.

## Personalidad

- Editorial, táctil y contemporánea.
- Competitiva sin ser agresiva.
- Musical sin recurrir a clichés decorativos.
- Académica sin parecer una plataforma corporativa.
- Chilena sin depender de banderas o estereotipos.

## Marca

- Logo principal: `assets/brand/vector/musicfest-logo-b-festival-vector.svg`.
- Fondos oscuros: `assets/brand/vector/musicfest-logo-d-noche-vector.svg`.
- Uso institucional: `assets/brand/vector/musicfest-logo-a-institucional-vector.svg`.
- Uso promocional: `assets/brand/vector/musicfest-logo-c-acento-vector.svg`.
- Destello azul sobre papel; verde ácido solamente sobre negro.
- Zona de seguridad mínima: ancho del micrófono.
- Tamaño mínimo: 96 px digital o 24 mm impreso.

## Paleta

| Rol | Color | Uso |
|---|---|---|
| Backstage | `#171710` | Fondo nocturno, texto, estructura |
| Paper | `#F2EFDF` | Superficies, fondos claros |
| Pulse | `#FF4D22` | Acción, urgencia, marca principal |
| Electric | `#4CA5FF` | Orientación y destello sobre fondos claros |
| Signal | `#C6F43D` | Éxito, selección válida y fondos oscuros |

## Tipografía

- **Archivo Black:** títulos, números, score y momentos de presión.
- **DM Sans:** instrucciones, formularios, métricas y lectura prolongada.

## Principios de interfaz

1. La portada del artista es el centro de la tarjeta.
2. Toda restricción debe mostrar valor actual, límite y estado.
3. El color refuerza; nunca reemplaza texto, número o icono.
4. Cada selección debe comunicar inmediatamente su costo de oportunidad.
5. El resultado debe facilitar que el equipo defienda su decisión.

## Guardrails

Evitar neón cyberpunk, gradientes púrpura, dashboards corporativos, estética infantil, ecualizadores, notas musicales y decoraciones sin función.

El moodboard y las aplicaciones de referencia están disponibles en la sección **Moodboard** del prototipo navegable.

## Flujos funcionales

### Entrada común

1. El estudiante ingresa código de partida y nombre de equipo.
2. Entra a un lobby que comunica modalidad, objetivo y estado de la sesión.
3. El docente inicia la experiencia; los equipos reciben el brief activo.

### Estudiante · modo secuencial

1. Leer el brief del día.
2. Explorar el pool disponible y construir el lineup.
3. Validar restricciones y popularidad en vivo.
4. Confirmar la entrega mediante una advertencia de irreversibilidad.
5. Bloquear el día y retirar sus artistas del pool siguiente.
6. Repetir para cada día y finalizar con resultados agregados.

### Estudiante · modo simultáneo

1. Comparar los briefs de todos los días.
2. Distribuir cada artista en un único día o dejarlo fuera.
3. Observar restricciones locales y resultado global en vivo.
4. Confirmar y bloquear el festival completo.
5. Comparar la solución con otros equipos y, si corresponde, con el óptimo.

### Docente

1. Crear una partida como borrador.
2. Elegir modalidad, configurar reglas y curar el pool.
3. Definir intentos, ranking y visibilidad del óptimo.
4. Previsualizar la experiencia como estudiante.
5. Publicar una versión inmutable y generar código de acceso.
6. Abrir lobby, iniciar, pausar, avanzar o reabrir entregas.
7. Cerrar la actividad y exportar resultados.

En modalidad secuencial, el docente puede volver desde domingo a sábado o viernes y reabrir la actividad. La reapertura es retroactiva: el día elegido y todos los días posteriores vuelven a estado editable porque la disponibilidad de artistas puede haber cambiado.

### Contrato de estados

- **Borrador:** editable y autoguardado.
- **Enviado:** bloqueado para el equipo.
- **Cerrado:** incorporado a resultados.
- **Reabierto:** vuelve a borrador por acción docente y conserva historial.
- **Pendiente de revalidación:** conserva el lineup existente, pero no cuenta como entrega válida hasta revisar nuevamente sus restricciones.

Al reabrir un día anterior, se conservan las selecciones de todos los días afectados; no se borran. El sistema recalcula disponibilidad y restricciones, marca los conflictos y exige reenviar cada día desde el punto reabierto. Si expira el tiempo, el borrador queda congelado pero no se envía silenciosamente. El docente decide si acepta el estado existente o reabre la ronda. Una entrega inválida nunca se bloquea.
