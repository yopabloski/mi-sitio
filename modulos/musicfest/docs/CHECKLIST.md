# MusicFest · checklist de publicación

Para tener al lado mientras lo haces. Cada paso tiene su comprobación: si no
pasa, no sigas al siguiente.

Proyecto: `streamlab-b9122` · Sitio: `yopabloski.github.io/mi-sitio`

---

## 1 · Authentication: habilitar proveedores

Consola → **Authentication → Sign-in method**

- [ ] Habilitar **Google** (elige tu correo como email de soporte)
- [ ] Habilitar **Anónimo**

**Comprobación:** ambos aparecen como "Habilitado" en la lista.

---

## 2 · Authentication: dominios autorizados

Consola → **Authentication → Settings → Authorized domains**

- [ ] Agregar `yopabloski.github.io`

**Comprobación:** la lista muestra `localhost`, `streamlab-b9122.firebaseapp.com`,
`streamlab-b9122.web.app` y `yopabloski.github.io`.

> Sin esto el login docente funciona en local y falla en producción con
> `auth/unauthorized-domain`. Es el error más fácil de olvidar.

---

## 3 · Validar las reglas sin publicar

Consola → **Firestore Database → Rules**

- [ ] Abrir `mi-sitio/firestore.rules`, copiar todo
- [ ] Pegarlo en el editor de la consola
- [ ] Ver que no aparezcan errores de sintaxis
- [ ] **NO publicar desde ahí.** Salir sin guardar

**Comprobación:** el editor no marca errores. Si marca algo, para y avísame.

---

## 4 · Clave de servicio

Consola → **⚙ Configuración del proyecto → Cuentas de servicio → Generar nueva
clave privada**

```bash
mkdir -p ~/Desktop/UDD/Admisión/mi-sitio/.secrets
# mover el JSON descargado ahí, por ejemplo:
mv ~/Downloads/streamlab-b9122-*.json \
   ~/Desktop/UDD/Admisión/mi-sitio/.secrets/streamlab-service-account.json
```

**Comprobación:**

```bash
ls ~/Desktop/UDD/Admisión/mi-sitio/.secrets/
cd ~/Desktop/UDD/Admisión/mi-sitio && git status --short | grep secrets
```

El primero muestra el archivo; el segundo **no debe mostrar nada** (está
ignorado). Si aparece, para: no hagas commit de esa clave.

---

## 5 · Variables de entorno

En realidad no hace falta ninguna: los scripts buscan solos la clave dentro de
cualquier `.secrets/` subiendo desde el módulo, y el proyecto por defecto es
`streamlab-b9122`.

Si quieres el archivo igual:

```bash
cd ~/Desktop/UDD/Admisión/mi-sitio/modulos/musicfest
cp .env.example .env
```

**Comprobación:** cualquier script imprime `Clave de servicio: /ruta/...` antes
de escribir. Si no encuentra la clave, te dice exactamente qué hacer.

---

## 6 · Desplegar las reglas

```bash
cd ~/Desktop/UDD/Admisión/mi-sitio
cp .firebaserc.example .firebaserc
firebase deploy --only firestore:rules,firestore:indexes
```

**Comprobación:** `Deploy complete!` y, en la consola, la pestaña Rules muestra
las reglas nuevas con MovieBlend y La Odisea intactas.

> Si algo saliera mal, el estado anterior está en
> `firestore.rules.backup-2026-08-10`.

---

## 7 · Crear tu cuenta docente

Primero abre el panel **en local** y entra con Google:

```bash
cd modulos/musicfest && npm run serve
```

Abre `http://localhost:5173/modulos/musicfest/admin.html` y pulsa
*Entrar con Google*.

- [ ] Va a fallar con "todavía no está autorizada". **Es lo esperado.**

Eso crea tu usuario en Authentication. Ahora autorízate:

```bash
cd ~/Desktop/UDD/Admisión/mi-sitio/modulos/musicfest
npm run admin:grant -- --email TU-CORREO-DE-GOOGLE
npm run admin:grant -- --list
```

**Comprobación:** la tabla muestra tu UID y tu correo.

> Usa el correo de la cuenta Google con la que entraste al panel, que puede no
> ser el institucional. La autorización va por UID, no por dominio.

Recarga el panel y vuelve a entrar: ahora debe abrirse.

---

## 8 · Cargar la actividad

```bash
npm run import:activity -- --dry-run    # informa, no escribe
npm run import:activity                 # escribe y verifica
```

**Comprobación:** `✓ Importación verificada. activityId = mf-demo-...`, con
81 artistas escritos y 81 esperados.

---

## 9 · Carátulas al repositorio

```bash
npm run covers:download -- --dry-run
npm run covers:download -- --code DEMO
```

**Comprobación:** aparece `assets/covers/` con las imágenes y la tabla final
dice 0 con problemas. Si alguna falla, conserva su URL externa y no rompe nada.

---

## 10 · Publicar

```bash
cd ~/Desktop/UDD/Admisión/mi-sitio
git add .
git status --short          # revisa que NO aparezca .secrets ni node_modules
git commit -m "Agregar MusicFest como módulo de la plataforma"
git push
```

**Comprobación:** en dos o tres minutos,
`https://yopabloski.github.io/mi-sitio/` muestra la tarjeta de MusicFest.

---

## 11 · Prueba de fuego

Con dos navegadores distintos (o uno normal y otro en incógnito):

- [ ] **Docente**: `.../modulos/musicfest/admin.html` — entras con Google y ves
      el catálogo con carátulas
- [ ] **Estudiante**: `.../modulos/musicfest/` con el código `DEMO` y un nombre
      de equipo
- [ ] El estudiante ve "El escenario todavía está cerrado"
- [ ] El docente pulsa **Iniciar** → al estudiante se le abre solo, sin recargar
- [ ] El estudiante arma un lineup válido y lo envía
- [ ] La entrega aparece en la bandeja del docente con el recálculo del servidor
- [ ] El docente valida
- [ ] El docente reabre el día → el estudiante ve "debe validarse y enviarse
      nuevamente", con sus artistas conservados
- [ ] En Firestore, la entrega de la revisión 1 sigue existiendo

Y una comprobación técnica: abre las herramientas del navegador, pestaña **Red**,
y confirma que las carátulas cargan desde `yopabloski.github.io` y no desde
`mzstatic.com`.

---

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| `auth/unauthorized-domain` al entrar como docente | Falta el paso 2 |
| "todavía no está autorizada" después del paso 7 | El `admin:grant` no encontró tu UID: entra primero con Google |
| `permission-denied` al entrar como estudiante | Falta habilitar **Anónimo** (paso 1) |
| `Missing or insufficient permissions` en el panel | Las reglas no se desplegaron (paso 6) |
| El estudiante no ve el código | La actividad no se importó (paso 8) o el código no coincide |
| Las carátulas no cargan | Normal si no corriste el paso 9: usan el CDN de Apple |

Y siempre está el plan B: vaciar `apiKey` en `js/services/firebase-config.js`
devuelve el módulo al modo demo con `localStorage`, que funciona sin red.
