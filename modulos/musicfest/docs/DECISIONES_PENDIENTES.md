# MusicFest · Decisiones pendientes antes de producción

Ordenadas por lo que bloquea. Ninguna impide seguir trabajando con emuladores.

## 1. Cuentas docentes · bloquea el primer login real

Elegiste Google sin restricción de dominio, con autorización por padrón. Falta:

- Tu UID de Google en `streamlab-b9122` (aparece en Authentication tras tu
  primer inicio de sesión), o dejar que `npm run admin:grant -- --email ...` lo
  resuelva.
- Si hay ayudantes que también dirigirán sesiones, sus correos.

Nota: hoy cualquier docente del padrón puede administrar cualquier actividad de
MusicFest, no sólo las propias. Para clases con ayudantes suele ser lo cómodo.
Si prefieres que cada quien administre sólo lo suyo, es un cambio de dos líneas
en las reglas (`resource.data.ownerUid == request.auth.uid`).

## 2. Cloud Functions · no bloquea, pero define el techo de rigor

Elegiste Spark. Con eso, el estudiante calcula sus totales y el panel docente
los recalcula y marca las diferencias (§5 de `FIREBASE_ARCHITECTURE.md`). Es
suficiente para clase, porque además nada cuenta hasta que tú validas.

Si en algún momento quieres cerrar la brecha del todo —por ejemplo si MusicFest
pasa a ser evaluado— habilitar Blaze y mover `recomputeSubmission()` a una
Function `submitLineup` es un cambio acotado: la función ya es pura y no toca la
interfaz. **Decisión: dejarlo así por ahora, o presupuestarlo.**

## 3. Política de equipos por defecto

Hoy `teamJoinPolicy: 'open'`: un segundo dispositivo puede sumarse a un equipo
existente escribiendo el mismo nombre. Cómodo, y a la vez significa que alguien
podría entrar al equipo ajeno si adivina el nombre.

- ¿Lo dejamos abierto y confiamos en el aula?
- ¿O `locked` por defecto, con un botón "liberar equipo" en el panel?

## 4. Visibilidad de las entregas entre equipos

Hoy cualquiera con el código puede leer las entregas de los demás, porque el
Design Book pide comparar soluciones. ¿Vale también mientras la ronda está en
curso, o preferirías que las entregas ajenas sólo se vean una vez validadas?

## 5. Retención de datos

No hay política de borrado. Una actividad de un semestre quedará ahí con sus
equipos y entregas. ¿Archivamos por semestre, exportamos a JSON y borramos, o
dejamos que se acumule? Firestore en Spark tiene 1 GiB de almacenamiento; una
actividad completa pesa del orden de decenas de KB, así que no urge.

## 6. App Check

Recomendado si el enlace circula fuera de clase. Requiere registrar el sitio en
reCAPTCHA Enterprise. ¿Lo dejamos para una etapa siguiente?

---

## Lo que ya está decidido y no necesita respuesta

| Tema | Decisión | Dónde se explica |
|---|---|---|
| Prefijo de colecciones | `musicfest*` para no chocar con MovieBlend | `FIREBASE_ARCHITECTURE.md` §2 |
| Padrón docente | `musicfestAdmins/{uid}` en vez de custom claims o UID en el cliente | `SECURITY_RULES.md` |
| Auth estudiante | Anónima automática | Arquitectura §1 original |
| Catálogo | Por actividad, no global | `FIREBASE_ARCHITECTURE.md` §3 |
| Borradores | Uno por revisión, en la ruta | `FIREBASE_ARCHITECTURE.md` §3 |
| Modo demo | Se conserva intacto como respaldo y rollback | `FIREBASE_MIGRATION_PLAN.md` |
| Hosting | GitHub Pages, como el resto de la plataforma | `PUESTA_EN_MARCHA.md` |
| Carátulas | En el repositorio, no en Storage (exige Blaze) | `CARATULAS.md` |
| Reglas de Firestore | Verificadas contra producción, sin diferencias | `PUESTA_EN_MARCHA.md` |
