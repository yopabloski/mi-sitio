# MusicFest · puesta en marcha en mi-sitio

Contexto real de este sitio:

- **Hosting: GitHub Pages** (`yopabloski.github.io/mi-sitio`). Publicar es `git push`.
- **Firebase es sólo backend**: Firestore, Storage y Authentication del proyecto
  `streamlab-b9122`, el mismo que usan MovieBlend y La Odisea.
- Por eso `firebase.json` **no** declara `hosting`: evita que un deploy
  accidental publique una copia paralela del sitio.

---

## Paso 0 · Herramientas (una sola vez)

```bash
node -v          # 20 o superior; probado en 22 y 24
firebase login   # firebase-tools viene en devDependencies
```

Los emuladores necesitan **Java 21 o superior**:

```bash
java -version                       # si dice 11 o menos:
brew install --cask temurin@21      # macOS con Homebrew
```

### Sobre los avisos de `npm install`

- **`EBADENGINE ... superstatic`**: era firebase-tools 13, que sólo declara
  soporte hasta Node 22. Ya está fijado en `^15`, que soporta Node 24. Si el
  aviso reaparece, borra `node_modules` y `package-lock.json` y reinstala.
- **`npm audit` reporta vulnerabilidades**: vienen de dependencias transitivas
  de `firebase-tools` y `firebase-admin`. Son **sólo de desarrollo**: no viajan
  al navegador ni al sitio publicado, porque el módulo carga el SDK de Firebase
  desde el CDN y no empaqueta nada. No corras `npm audit fix --force`: rompería
  firebase-tools sin ganar nada.
- **`deprecated`**: idem, ruido de dependencias ajenas.

---

## Paso 1 · Probar en local sin tocar nada remoto

```bash
cd ~/Desktop/UDD/Admisión/mi-sitio/modulos/musicfest
npm install
npm test                  # dominio (31) + humo de extremo a extremo (6)
npm run test:rules        # reglas contra el emulador (27)
npm run test:integration  # ciclo completo contra Firestore emulado (5)
```

Las 69 pruebas están en verde. Las dos últimas necesitan Java 21+.

Y ver el sitio completo:

```bash
npm run serve                 # sirve la raíz de mi-sitio en http://localhost:5173
PORT=8080 npm run serve       # si 5173 estuviera ocupado
```

> El puerto 5000 no sirve en macOS: lo ocupa el receptor de AirPlay. Si ves
> `Address already in use`, mira quién lo tiene con `lsof -i :5173`.

Abre `http://localhost:5173/` y verifica que aparezca la tarjeta de MusicFest
junto a MovieBlend y La Odisea. Sin configuración de emuladores, el módulo corre
en **modo demo** con `localStorage`: código `DEMO`, docente y estudiante en
pestañas distintas. Es exactamente el prototipo que ya probaste.

---

## Paso 2 · Reglas de Firestore: verificado

**Hecho.** Las reglas vivas del proyecto se compararon con `firestore.rules` el
10 de agosto de 2026: las secciones de MovieBlend (`exports`, `activities`), La
Odisea (`experiences` con `teams` y `attempts`) y la función `isOdysseyAdmin`
están **idénticas carácter por carácter**. Lo único que cambia es lo que se
agrega para MusicFest.

El estado previo quedó respaldado en `firestore.rules.backup-2026-08-10`, en la
raíz del sitio, por si alguna vez hace falta volver atrás.

Verificación estructural del archivo nuevo: llaves, paréntesis y corchetes
balanceados, 38 sentencias `allow` bien terminadas, y ninguna llamada a una
función que no esté definida.

Antes de publicar, pega el archivo en el editor de reglas de la consola: valida
la sintaxis en vivo **sin publicar**, y es la única comprobación que ni las
pruebas locales ni un `diff` pueden hacer por ti.

### Storage: no se usa

Cloud Storage exige plan Blaze desde el 3 de febrero de 2026 y este proyecto
está en Spark, así que MusicFest no lo usa. Las carátulas se guardan en el
repositorio y se sirven desde GitHub Pages: ver `docs/CARATULAS.md`.

`firebase.json` tampoco declara `storage`, de modo que un despliegue no puede
tocarlo por accidente.

## Paso 3 · Preparar Firebase

En la [consola del proyecto](https://console.firebase.google.com/project/streamlab-b9122):

1. **Authentication → Métodos de acceso**: habilita **Google** y **Anónimo**.
2. **Authentication → Configuración → Dominios autorizados**: agrega
   `yopabloski.github.io`. Sin esto, el inicio de sesión con Google del panel
   docente falla en producción. `localhost` ya viene incluido.
3. Entra una vez a `https://yopabloski.github.io/mi-sitio/modulos/musicfest/admin.html`
   con tu cuenta Google. Fallará con "todavía no está autorizada" — es lo
   esperado, y sirve para que tu UID quede creado en Authentication.

---

## Paso 4 · Desplegar las reglas

```bash
cd ~/Desktop/UDD/Admisión/mi-sitio
cp .firebaserc.example .firebaserc
firebase deploy --only firestore:rules,firestore:indexes,storage
```

O, desde el módulo, `npm run deploy:rules` (hace lo mismo).

---

## Paso 5 · Autorizarte como docente

Necesita una clave de servicio:

1. Consola → **Configuración del proyecto → Cuentas de servicio → Generar nueva
   clave privada**.
2. Guarda el JSON en `mi-sitio/.secrets/streamlab-service-account.json`
   (`.secrets/` ya está en `.gitignore`).

```bash
cd ~/Desktop/UDD/Admisión/mi-sitio/modulos/musicfest
cp .env.example .env
# edita .env: GOOGLE_APPLICATION_CREDENTIALS=../../.secrets/streamlab-service-account.json

npm run admin:grant -- --email pablogonzalez@udd.cl
npm run admin:grant -- --list
```

---

## Paso 6 · Cargar la actividad

```bash
npm run import:activity -- --dry-run      # informa, no escribe
npm run import:activity                   # escribe y verifica
```

El importador es idempotente: repetirlo no duplica nada.

Y las carátulas al repositorio, para no depender del CDN de Apple Music:

```bash
npm run covers:download -- --dry-run
npm run covers:download -- --code DEMO    # baja y actualiza Firestore
```

---

## Paso 7 · Publicar

```bash
cd ~/Desktop/UDD/Admisión/mi-sitio
git add .
git commit -m "Agregar MusicFest como módulo de la plataforma"   # incluye assets/covers/
git push
```

GitHub Pages publica en un par de minutos:

- Portal: `https://yopabloski.github.io/mi-sitio/`
- Estudiante: `https://yopabloski.github.io/mi-sitio/modulos/musicfest/`
- Docente: `https://yopabloski.github.io/mi-sitio/modulos/musicfest/admin.html`

---

## Comprobación final

1. Portal: la tarjeta de MusicFest aparece y lleva al módulo.
   Las carátulas cargan desde el propio sitio, no desde mzstatic.com
   (compruébalo en la pestaña Red de las herramientas del navegador).
2. Panel docente: entras con Google y ves el catálogo con carátulas.
3. Estudiante en ventana de incógnito con el código `DEMO`.
4. El docente inicia; al estudiante se le abre el escenario sin recargar.
5. El equipo envía un lineup; aparece en la bandeja con el recálculo.
6. Validas; reabres el día y la entrega anterior sigue en Firestore.

---

## Emuladores (opcional, para ensayar sin tocar producción)

```bash
cd ~/Desktop/UDD/Admisión/mi-sitio/modulos/musicfest
npm run emulators           # otra terminal: npm run serve
USE_FIREBASE_EMULATORS=1 npm run import:activity
```

Y abre las páginas con `?emu=1`:

```
http://localhost:5173/modulos/musicfest/admin.html?emu=1
```

La preferencia queda guardada; `?emu=0` la borra. Con emuladores corriendo
también puedes ejecutar las dos suites que faltan:

```bash
npm run test:rules
npm run test:integration
```

---

## Volver atrás

Si algo sale mal en clase, el modo demo sigue intacto. Basta con vaciar
`apiKey` en `js/services/firebase-config.js` y el módulo vuelve a `localStorage`
sin depender de la red.
