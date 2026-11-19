# Cómo tomar las 16 evidencias (P-01 a P-16)

Sigue el orden. Cada bloque dice **qué haces**, **qué debe verse** y **qué capturas**.
Al final hay una verificación para no entregar nada mal.

---

## Antes de empezar

**1. La herramienta de captura**

- `Win + Shift + S` → se oscurece la pantalla → arrastra el recuadro → queda en el portapapeles.
- Abre **Paint** (`mspaint`) → `Ctrl + V` → `Ctrl + S` → guarda como **PNG** en
  `TercerParcial\demo-sesiones\evidencias\` con el nombre exacto: `P-01.png`, `P-02.png`…

**2. Capturas que necesitan dos pedazos** (P-02, P-04, P-08, P-10, P-11, P-12, P-13, P-14):
toma dos recortes y pégalos en el **mismo** Paint, uno al lado o debajo del otro, y guarda un solo PNG.
Para que quepan, antes de pegar el segundo estira el lienzo con la esquina blanca del canvas.

**3. Prepara las ventanas**

- Terminal 1 en `TercerParcial\demo-sesiones\base` → `npm start`. Debe decir:

  ```
  Demo de sesiones en http://localhost:4600
  Usuarios en MySQL: 3 (ana / ana12345 · luis / luis12345 · admin / admin12345)
  Las sesiones se guardan en: MySQL (tabla sessions)
  ```

- Chrome en `http://localhost:4600` → `F12`.
  - Pestaña **Network (Red)**. Activa **Preserve log** (casilla arriba) para que no se borre al recargar.
  - Pestaña **Application (Aplicación) → Cookies → http://localhost:4600**.
- MySQL Workbench abierto (root / `Josue2576+`) con esta consulta lista:

  ```sql
  SELECT session_id, expires, data FROM demo_sesiones.sessions;
  ```

  Ejecútala con `Ctrl + Enter` cada vez que la necesites.

**4. Nombres de archivo**

Se guardan como `P-01.png` … `P-16.png`. Cuando necesites dos piezas (P-02, P-04, P-08, P-10,
P-11, P-12, P-13, P-14), pégalas en un mismo PNG.

P-09 y P-15 se toman en dos momentos distintos (uno en el Grupo 1 y otro en el Grupo 2), así que
guárdalas como `P-09a.png` / `P-09b.png` y `P-15a.png` / `P-15b.png`. Si el profe exige exactamente
16 archivos, al final pega cada par en un solo `P-09.png` y `P-15.png`.

**5. Tres reglas**

- **No recargues la página** entre pasos que deben acumularse en la bitácora: `Ctrl+F5` la borra.
- Cada captura se guarda **antes** de seguir al siguiente paso.
- Si un paso no muestra lo que dice la tabla, **para** y revisa: seguir con una captura mala te obliga a repetir todo después.

---

# GRUPO 1 · con la configuración actual (no toques `config.js`)

## P-01 · La API arranca y lee la configuración

1. Acomoda la terminal a la izquierda (`Win + ←`) y Chrome a la derecha (`Win + →`).
2. La página debe mostrar la tarjeta **5 · Configuración actual**.

**Debe verse:** las 3 líneas de `npm start` en la terminal y el JSON:

```json
{
  "almacen": "mysql",
  "maxAgeMs": 600000,
  "rolling": false,
  "httpOnly": true,
  "sameSite": "lax",
  "regenerarAlEntrar": true
}
```

**Captura:** terminal + tarjeta 5 en el mismo PNG → `P-01.png`

---

## P-02 · Sin sesión: 401 y sin cookie

1. Si tienes sesión, pulsa **POST /api/logout**.
2. Pulsa **GET /api/perfil** → en la bitácora sale `401 · No has iniciado sesión (o tu sesión ya venció)`.
3. Network → clic en la petición `perfil` → **Headers** → **Response Headers**.
4. Application → **Cookies** → `http://localhost:4600`.

**Debe verse:** en los encabezados **no** aparece `Set-Cookie`, y en Cookies **no** hay `connect.sid`.

**Captura:** los dos pedazos en un PNG → `P-02.png`

---

## P-03 · Credenciales incorrectas (dos casos, mismo mensaje)

1. Con **ana** seleccionada, borra la contraseña y escribe `mala` → **Entrar**.
2. En la pestaña **Console** pega esto (el `<select>` no tiene a "pepe", por eso va por consola):

   ```js
   const r = await llamar('POST', '/api/login', { usuario: 'pepe', contrasena: 'pepe12345' });
   anotar('POST', '/api/login', r.status, r.datos);
   ```

**Debe verse:** dos entradas `401` en la bitácora con el **mismo** texto `Usuario o contraseña incorrectos`.

**Captura:** la tarjeta 3 completa → `P-03.png`

---

## P-04 · Login correcto: `Set-Cookie` y la fila en MySQL

1. Selecciona **ana**, contraseña `ana12345` → **Entrar**.
2. Network → `login` → **Headers** → **Response Headers** → localiza `Set-Cookie`.
3. En Workbench ejecuta el `SELECT` (`Ctrl + Enter`).

**Debe verse:** `Set-Cookie: connect.sid=s%3A…; Path=/; Expires=…; HttpOnly; SameSite=Lax`
y una fila nueva en `sessions` con el mismo `session_id` (el id va entre `s%3A` y el primer punto de la cookie).

**Captura:** encabezado + la fila de Workbench, marcando el mismo id → `P-04.png`

---

## P-05 · El navegador regresa la cookie solo

1. Pulsa **GET /api/perfil** una vez → bitácora: `visitas: 1`.
2. Púlsalo otra vez → `visitas: 2`.
3. Network → la segunda petición `perfil` → **Headers** → **Request Headers**.

**Debe verse:** `Cookie: connect.sid=s%3A…` (no lo escribiste tú) y la respuesta con `visitas` 1 y 2.

**Captura:** Request Headers + la bitácora con las dos visitas → `P-05.png`

---

## P-06 · El estado y la tabla del servidor

1. Pulsa **Volver a preguntar** (tarjeta 1).
2. Mira la tarjeta **4 · Lo que guarda el servidor**.

**Debe verse:** tarjeta 1 en verde con `Ana López · rol alumno · sesión … · vence en … s`,
y en la tabla tu fila marcada con `(la tuya)`.

**Captura:** la página completa (tarjetas 1 y 4) → `P-06.png`

---

## P-07 · 403: sé quién eres pero no puedes

1. Con la sesión de **ana**, pulsa **GET /api/admin/reporte**.

**Debe verse:** `403 · Eres ana, pero esta ruta es solo para admin` en la bitácora.

**Captura:** la tarjeta 3 → `P-07.png`

---

## P-09a · `httpOnly`: el JavaScript no ve la cookie

1. **Sin recargar** (sigue la sesión de ana), mira el recuadro de la tarjeta 1.
2. En Network, el `Set-Cookie` del login ya trae `HttpOnly` (lo puedes reutilizar de P-04).

**Debe verse:** `document.cookie` → `(vacío)` aunque estés dentro.

**Captura:** tarjeta 1 → `P-09a.png` (la otra mitad del criterio va en P-09b)

---

## P-08 · 401 contra 403 contra 200 (la tabla)

Sigue **sin recargar** para que se acumule todo en la bitácora:

1. Arriba ya tienes el `403` de P-07.
2. Pulsa **POST /api/logout** → `200`.
3. Pulsa **GET /api/admin/reporte** → `401` (sin sesión no sabe quién eres).
4. Entra como **admin** / `admin12345` → `200` en el login.
5. Pulsa **GET /api/admin/reporte** → `200` con `Talleres: 3 · Inscritos: 57 · Cupo libre: 18`.

**Captura:** bitácora con el 403, el 401 y el 200 + la tabla llena → `P-08.png`

---

## P-10 · Logout destruye la sesión en el servidor

1. Con la sesión de **admin**: Workbench → `Ctrl + Enter` (hay fila).
2. Pulsa **POST /api/logout**.
3. Network → `logout` → **Response Headers**.
4. Workbench → `Ctrl + Enter` otra vez.

**Debe verse:** `Set-Cookie: connect.sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
y la tabla `sessions` **sin** esa fila.

**Captura:** encabezado + Workbench sin la fila → `P-10.png`

---

## P-11 · Secuestro de sesión

1. **Víctima** (ventana normal): entra como **ana**.
2. Application → Cookies → doble clic en el **Value** de `connect.sid` → `Ctrl + C` (cópialo completo).
3. **Atacante**: `Ctrl + Shift + N` (incógnito) → `http://localhost:4600` → `F12` → **Console**:

   ```js
   document.cookie = 'connect.sid=PEGA_AQUI_EL_VALOR; path=/';
   ```

   (Si Chrome no deja pegar: escribe `allow pasting`, Enter, y vuelve a pegar.)
4. Atacante: pulsa **Volver a preguntar** → debe salir **Ana López** en verde, sin contraseña.
5. Víctima: **POST /api/logout**.
6. Atacante: **Volver a preguntar** → ahora `401`.

**Captura:** el atacante con 200 y, debajo, el atacante con 401 → `P-11.png`

---

## P-15a · La sesión sobrevive al reinicio (MySQL)

1. Entra como **ana**.
2. En la terminal: `Ctrl + C` y otra vez `npm start`.
3. En la página **no recargues**: pulsa **Volver a preguntar**.

**Debe verse:** sigues dentro (tarjeta 1 en verde). El servidor nuevo leyó la fila de `sessions`.

**Captura:** tarjeta 1 + la terminal con el reinicio → `P-15a.png`

---

## P-16 · Las 21 pruebas

1. Abre **otra** terminal en `base` (deja el servidor corriendo o detenlo, da igual).
2. `npm run probar`.

**Debe verse:** 21 líneas con `✔` y al final `21 de 21 pruebas pasaron.`

**Captura:** la terminal completa (si no cabe, agranda la ventana) → `P-16.png`

---

# GRUPO 2 · un cambio de `config.js` por captura

> En cada cambio: guarda `config.js` → `Ctrl + C` → `npm start` → `Ctrl + F5` en el navegador.
> Al terminar **cada** subgrupo, regresa el valor como estaba.

## P-09b · `httpOnly: false`

1. `httpOnly: false` → reinicia → recarga.
2. Entra como **ana**.
3. Mira el recuadro de la tarjeta 1.

**Debe verse:** `connect.sid=s%3A…` (y el `Set-Cookie` **sin** `HttpOnly`).

**Captura:** tarjeta 1 → `P-09b.png`
**Después:** regresa `httpOnly: true` → reinicia.

---

## P-12 · Expiración y rolling

**Parte 1 — `maxAgeMs: 20 * 1000`, `rolling: false`**

1. Reinicia y recarga. Entra como **ana**.
2. Espera **25 s sin tocar nada**.
3. Pulsa **GET /api/perfil**.

**Debe verse:** `401 · Tu sesión venció: vuelve a iniciar sesión` (lo decidió el servidor).

**Captura:** bitácora.

**Parte 2 — `rolling: true` (con el mismo `maxAgeMs`)**

1. Reinicia y recarga. Entra como **ana**.
2. Pulsa **GET /api/perfil** y mira la tarjeta 1; espera 5 s y vuelve a pulsarlo.

**Debe verse:** el contador **vuelve a ~20 s** en cada petición (dos capturas en momentos distintos).
3. Deja de tocar la página **25 s** y pulsa **GET /api/perfil**.

**Debe verse:** `401` (venció por inactividad).

**Captura:** las tres piezas en un PNG → `P-12.png`
**Después:** `maxAgeMs: 10 * 60 * 1000` y `rolling: false` → reinicia.

---

## P-13 · Fijación de sesión SIN protección

1. `regenerarAlEntrar: false` → reinicia → recarga.
2. **Víctima** (normal): si tiene sesión, **POST /api/logout** (si no, no podrá sobrescribir la cookie `HttpOnly`).
3. **Atacante** (incógnito): entra a la página → **POST /api/visita** → Application → copia el **Value** de su `connect.sid`.
4. **Víctima**: Console:

   ```js
   document.cookie = 'connect.sid=VALOR_DEL_ATACANTE; path=/';
   ```

   y luego entra como **ana**.
5. Mira la respuesta del login en la bitácora: `sesionAntes` y `sesionDespues` son **iguales**.
6. **Atacante**: **Volver a preguntar** → sigue dentro como **Ana**.

**Captura:** login con los dos ids iguales + el atacante en verde → `P-13.png`
**Después:** `regenerarAlEntrar: true` → reinicia.

---

## P-14 · Fijación CON protección

Repite los pasos 2 a 6 de P-13.

**Debe verse:** `sesionAntes` **distinto** de `sesionDespues`, y el atacante recibe **401**.

**Captura:** los dos ids distintos + el 401 del atacante → `P-14.png`

---

## P-15b · La sesión NO sobrevive en memoria

1. `almacen: 'memoria'` → reinicia → recarga.
2. Entra como **ana**.
3. `Ctrl + C` y `npm start`.
4. **Volver a preguntar.**

**Debe verse:** `401` aunque la cookie `connect.sid` siga en Application.

**Captura:** tarjeta 1 en rojo + el panel Cookies con la cookie → `P-15b.png`
**Después:** `almacen: 'mysql'` → reinicia.

---

# Verificación final (no la saltes)

1. Abre `base/config.js` y confirma:

   ```js
   almacen: 'mysql',
   maxAgeMs: 10 * 60 * 1000,
   rolling: false,
   httpOnly: true,
   sameSite: 'lax',
   regenerarAlEntrar: true,
   ```

2. Reinicia con `npm start` y recarga con `Ctrl + F5`.
3. F12 → **Console**: no debe haber líneas en rojo.
4. `npm run probar` → `21 de 21 pruebas pasaron.`
5. En `evidencias/` deben existir **P-01 … P-16** (P-09 y P-15 con a/b si los separaste).
6. Borra este archivo (`PASO-A-PASO.md`) y el `LEEME.md` antes de entregar, si el profe solo quiere las imágenes.
