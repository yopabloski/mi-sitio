# MusicFest · cartas para imprimir

Las cartas físicas del pool, maquetadas en hojas carta a medidas reales de
funda, para recortar y jugar sobre la mesa.

## Cómo se llega

Desde el panel docente, botón **Cartas para imprimir**, debajo de *Exportar
configuración*. Abre `cartas.html` en una pestaña nueva con el código de la
actividad ya puesto. También se puede entrar directo:

```
cartas.html?code=DEMO&tamano=euro&reversos=largo
```

## Qué imprime

El **pool activo de la actividad**, no el catálogo semilla: los artistas que el
docente dejó en juego, con sus ediciones y sus artistas personalizados, y sin
los que retiró. La carátula sale de la misma cadena de prioridad que usa la
vista del estudiante, así que es la copia del repositorio.

Un artista sin carátula sale con sus iniciales sobre el color de su género. La
página avisa cuántos son antes de imprimir.

## Tamaños

| | Medida | Por hoja |
|---|---|---|
| Mini American | 41 × 63 mm | 4 × 4 = 16 |
| Mini Chimera | 43 × 65 mm | 4 × 4 = 16 |
| Mini Euro | 45 × 68 mm | 4 × 3 = 12 |

Son las tres medidas de funda mini estándar. El reparto por hoja no está
escrito a mano: sale de dividir el área imprimible de la carta —216 × 279 mm
menos 8 mm de margen por lado— por el tamaño elegido. Si algún día cambia el
margen, el reparto se ajusta solo y las pruebas lo verifican.

## Doble cara

Con reversos, cada hoja de caras va seguida de su hoja de reversos, espejada
para que cada reverso caiga sobre su propia carta al voltear el papel. El
espejo depende de cómo voltee la impresora:

- **Borde largo** — el volteo es horizontal, se invierte cada fila. Es lo que
  hacen casi todas las impresoras en vertical, y es el valor por defecto.
- **Borde corto** — la hoja gira 180°, se invierte la página entera.

Si la primera prueba sale descuadrada, cambia esta opción antes de tocar
cualquier otra cosa: es la causa en la práctica totalidad de los casos.

Las páginas incompletas se rellenan con huecos para que el espejo no corra las
posiciones. Sin eso, la última hoja —la que nadie revisa— saldría con cada
reverso pegado a la carta equivocada.

## Al imprimir

Tres ajustes en el diálogo de impresión, y los tres importan:

- **Escala 100%**, sin «ajustar a la página». Si el navegador reduce para
  ajustar, las cartas salen más chicas y dejan de entrar en la funda.
- **Márgenes: ninguno.** El margen ya está en el diseño de la hoja.
- **Gráficos de fondo activados**, o las cintas de género salen en blanco.

Con eso, *Guardar como PDF* deja un archivo listo para llevar a imprimir.

## Dónde está el código

- `cartas.html` — la página y su CSS de impresión. Las medidas viven acá, en
  milímetros.
- `js/domain/cartas.js` — la aritmética de la hoja: reparto, paginado, espejo y
  lectura del pool. Puro, sin DOM.
- `js/ui/cartas-print.js` — el dibujo y la conexión con la actividad.
- `tests/domain/cartas.test.mjs` — 13 pruebas sobre la geometría, que es lo
  único de una impresión que se puede comprobar sin gastar papel.

La vista se conecta con `role: 'student'` y sin `teamName`: firma anónimo, lee
la actividad y no crea ningún equipo en la bandeja de entregas.
