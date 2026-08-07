# Odisea Óptima · módulo estático

Versión recomendada para integrar en el repositorio actual de StreamLab: conserva su arquitectura de HTML, CSS y JavaScript sin compilación.

## Probar

Sirva esta carpeta con cualquier servidor estático (por ejemplo Firebase Hosting). Si `firebase.js` no tiene credenciales, funciona automáticamente como demo local.

## Activar Firebase

1. Copie la configuración web de Firebase en `firebaseConfig`, dentro de `firebase.js`.
2. Active autenticación anónima y Firestore.
3. Publique `firestore.rules`.
4. Asigne el custom claim `admin: true` a los docentes que usarán `admin.html` y añada el inicio de sesión institucional que prefiera.

## Integración

Copie la carpeta como `/odisea/` dentro del sitio actual y enlace `odisea/index.html`. No modifica ni depende de la app de películas. También puede incrustarse en un `iframe`.

## Datos

```text
experiences/{codigo-normalizado}
  code, active, round, nodeCount, updatedAt
  teams/{teamId}: name, uid, lastScore, lastMetric, lastRound
  attempts/{attemptId}: teamId, teamName, round, metric, route[], score, validated, validatedAt, createdAt
```

Las matrices están en `data.js`. Mar de Bruma utiliza distancia navegada, tiempo y peligro simétricos derivados de las posiciones del mapa. Vientos Contrarios aplica factores direccionales y produce matrices asimétricas. La Ira de Poseidón mantiene la asimetría y cierra conexiones seleccionadas, representadas por `null`. El docente controla la ronda y la métrica objetivo compartida por todos los equipos; los participantes sólo pueden construir la ruta del problema activo. El puntaje se calcula localmente y se registra con la ruta completa para análisis posterior. El docente define entre 5 y 17 nodos; Troya e Ítaca siempre permanecen activos. Cada código crea una experiencia y un leaderboard independientes. Una experiencia pausada rechaza nuevos equipos e intentos tanto en la interfaz como en las reglas de Firestore.

Cada solución comienza únicamente con `Troy → Ithaca`. Todos los nodos seleccionados por el docente son obligatorios: el botón de entrega permanece bloqueado hasta incluirlos exactamente una vez, con Troy como origen e Ithaca como destino. Esta condición también se valida en las reglas de Firestore.

El panel docente incluye un editor visual de locaciones. Las coordenadas se guardan como porcentajes `{x, y}` dentro de `nodePositions`, por lo que permanecen alineadas al mapa en pantallas de cualquier tamaño y pueden variar entre actividades.

La bitácora administrativa escucha en tiempo real todos los intentos de la actividad seleccionada. Cada entrega nace con `validated: false`; el leaderboard sólo utiliza resultados validados de la ronda y métrica actualmente activas. El docente puede validar, retirar la validación o eliminar una entrega. La exportación `.xlsx` incluye sesión, equipo, ruta, métrica, valor objetivo, ronda, fecha y estado de validación.

Las selecciones del panel docente funcionan como un borrador: cambiar ronda, objetivo o localidades no altera la experiencia de los estudiantes hasta pulsar **Guardar configuración**. Cada entrega registra además `durationMs`, medido desde que el equipo abre por primera vez esa configuración en el navegador. El ranking ordena primero por el menor valor objetivo y utiliza el menor tiempo como desempate. La sesión Google del docente se restaura automáticamente después de recargar la página.

La bitácora mantiene la escucha en vivo de Firestore y añade una comprobación automática cada 10 segundos y el botón **Actualizar ahora**, ambos sin recargar la página. Las nuevas entregas guardan `activityCode` y `configurationName` para que la actividad y la configuración sean identificables directamente en Firestore y en las exportaciones.

Cada problema se identifica mediante `configurationKey`, construido con la ronda, la métrica objetivo y el conjunto exacto de localidades activas. Las entregas guardan además `activeNodeIds` y `nodeCount`. El leaderboard, la comparación con el óptimo y la vista activa de la bitácora sólo comparan entregas con la misma clave; cambiar de ronda, métrica o localidades crea una configuración distinta sin borrar el historial anterior. Los registros antiguos sin esta información permanecen disponibles únicamente en la vista de historial completo.

## Fichas imprimibles

El panel docente ofrece una ficha de estudiante y una pauta docente en A4 horizontal. Ambas se construyen desde la selección actualmente visible, aunque todavía no se haya guardado, e incluyen escenario, métrica, unidad, matriz y leyenda de acrónimos. La ficha deja espacios para equipo, integrantes, ruta y resultado; la pauta incorpora la ruta y el valor óptimos. `print.html`, `print.js` y `print.css` conforman una vista independiente preparada para imprimir o guardar como PDF en una sola página.

## Solución óptima docente

El panel docente calcula la ruta hamiltoniana dirigida óptima desde Troya hasta Ítaca, visitando exactamente una vez todas las locaciones activas. Para instancias de hasta seis nodos utiliza el modelo MILP de `javascript-lp-solver` con variables binarias, restricciones de grado y eliminación de subciclos MTZ. Para instancias mayores utiliza Held–Karp adaptado a origen y destino diferentes, que también es exacto y resulta más rápido en el navegador para el máximo de 17 nodos. El cálculo se ejecuta en `optimal-worker.js` para no bloquear la interfaz. La distribución web de `javascript-lp-solver` se conserva localmente en `vendor-solver.js`; su licencia Unlicense está en `vendor-solver.LICENSE`.
