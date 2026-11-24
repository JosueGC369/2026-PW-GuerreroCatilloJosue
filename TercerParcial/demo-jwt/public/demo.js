// La página solo hace fetch a la API. El navegador manda la cookie solo (misma página, mismo servidor).
const $ = (id) => document.getElementById(id);

// Una sola función porque los ocho endpoints comparten contrato: JSON que entra, JSON que sale y un código HTTP.
// El código se lee en respuesta.status (fetch no falla con 401 ni 403), sin credentials porque es el mismo origen,
// y si la respuesta no es JSON se atrapa el error para que datos quede en null y la página no truene.
async function llamar(metodo, url, cuerpo) {
  const opciones = { method: metodo, headers: {} };

  if (cuerpo) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }

  const respuesta = await fetch(url, opciones);

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }

  return { status: respuesta.status, datos };
}

// textContent y no innerHTML porque el JSON trae nombres escritos por personas: con innerHTML se interpretarían
// como HTML y un script metido ahí podría robar la cookie si no fuera httpOnly. append y un <ol> normal: la
// primera respuesta queda como 1 arriba y las siguientes van saliendo abajo, en orden.
function anotar(metodo, url, status, datos) {
  const li = document.createElement('li');

  const clase = status < 300 ? 'ok' : status === 401 ? 'e401' : status === 403 ? 'e403' : 'error';

  const codigo = document.createElement('span');
  codigo.className = `codigo ${clase}`;
  codigo.textContent = String(status);

  const titulo = document.createElement('code');
  titulo.textContent = ` ${metodo} ${url}`;

  const cuerpo = document.createElement('pre');
  cuerpo.textContent = datos === null ? '(sin JSON)' : JSON.stringify(datos, null, 2);

  li.append(codigo, titulo, cuerpo);

  // La lista tiene altura máxima: al agregar abajo se baja el scroll para que la nueva se vea sin mover la página.
  const bitacora = $('bitacora');
  bitacora.append(li);
  bitacora.scrollTop = bitacora.scrollHeight;
}

// Se le pregunta al servidor porque la cookie es httpOnly: el navegador la manda sola, pero document.cookie sale
// vacío aunque haya sesión, así que el único que sabe quién eres es el servidor.
async function refrescarEstado() {
  const { status, datos } = await llamar('GET', '/api/sesion');
  const estado = $('estado');

  if (status === 200) {
    estado.textContent = `${datos.usuario.nombre} · rol ${datos.usuario.rol} · sesión ${datos.sesion} · vence en ${datos.expiraEnSegundos} s`;
    estado.className = 'estado con-sesion';
  } else {
    estado.textContent = 'Sin sesión (el servidor responde 401)';
    estado.className = 'estado sin-sesion';
  }

  $('cookie-js').textContent = document.cookie || '(vacío)';
}

// La tabla se reconstruye desde el servidor (fuente de verdad) y se vacía el <tbody> antes de llenarlo: si no,
// cada clic iría agregando filas. "expira" llega en ISO y se pasa a hora local con toLocaleTimeString.
async function refrescarSesiones() {
  const { datos: respuesta } = await llamar('GET', '/api/diagnostico/sesiones');
  const datos = respuesta ? respuesta.sesiones : [];

  if (respuesta) {
    $('donde').textContent = respuesta.almacen === 'memoria'
      ? 'En la MEMORIA del servidor: se borra al reiniciarlo.'
      : 'En MySQL, tabla sessions. En Workbench: SELECT * FROM demo_sesiones.sessions;';
  }

  const cuerpo = $('tabla-sesiones');
  cuerpo.textContent = '';

  if (datos.length === 0) {
    const fila = document.createElement('tr');
    const celda = document.createElement('td');
    celda.colSpan = 4;
    celda.textContent = '(sin sesiones)';
    fila.append(celda);
    cuerpo.append(fila);
    return;
  }

  for (const s of datos) {
    const fila = document.createElement('tr');
    if (s.esLaTuya) fila.className = 'tuya';
    const vence = s.expira ? new Date(s.expira).toLocaleTimeString() : '—';
    for (const valor of [s.sesion + (s.esLaTuya ? ' (la tuya)' : ''), s.usuario, s.visitas, vence]) {
      const celda = document.createElement('td');
      celda.textContent = valor;
      fila.append(celda);
    }
    cuerpo.append(fila);
  }
}

// La configuración también se vuelve a pedir: "Volver a preguntar" refresca toda la página, no solo el estado.
async function refrescarConfig() {
  const { datos } = await llamar('GET', '/api/config');
  $('config').textContent = datos === null ? '(no disponible)' : JSON.stringify(datos, null, 2);
}

// Casi toda acción cambia el estado y la tabla (login, logout, visita): se piden juntas para que ninguna quede
// mostrando datos viejos. La tarjeta 6 va incluida para que el token vencido o revocado se note solo.
async function refrescarTodo() {
  await refrescarEstado();
  await refrescarSesiones();
  await refrescarConfig();
  await refrescarToken();
  await listarTokens();
}

// change y no input: solo interesa cuando ya se eligió otro usuario, para poner su contraseña <usuario>12345.
$('usuario').addEventListener('change', () => {
  $('contrasena').value = `${$('usuario').value}12345`;
});

// preventDefault: sin él el navegador envía el formulario, recarga la página y se pierde la bitácora.
$('form-login').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const cuerpo = { usuario: $('usuario').value, contrasena: $('contrasena').value };
  const { status, datos } = await llamar('POST', '/api/login', cuerpo);
  anotar('POST', '/api/login', status, datos);
  await refrescarTodo();
});

// Un solo listener para todos los [data-url]: dataset trae data-metodo y data-url, y si mañana se agrega otro
// botón en el HTML funciona sin tocar este archivo.
for (const boton of document.querySelectorAll('[data-url]')) {
  boton.addEventListener('click', async () => {
    const { metodo, url } = boton.dataset;
    const { status, datos } = await llamar(metodo, url);
    anotar(metodo, url, status, datos);
    await refrescarTodo();
  });
}

// Estos dos botones solo repiten lo que ya hacen refrescarTodo y refrescarSesiones.
$('btn-refrescar').addEventListener('click', refrescarTodo);
$('btn-sesiones').addEventListener('click', refrescarSesiones);

// No hace falta esperar DOMContentLoaded: el <script> está al final del <body>, así que los elementos ya existen.
// JSON.stringify con 2 espacios es la sangría que respeta el <pre> de #config.
llamar('GET', '/api/config').then(({ datos }) => {
  $('config').textContent = datos === null ? '(no disponible)' : JSON.stringify(datos, null, 2);
});

refrescarTodo();

// ---------- El token (JWT) ----------
// La cookie la manda el navegador sola; el token no. Aquí se arma el encabezado Authorization
// a mano, que es la única forma en que el servidor recibe un JWT.
async function llamarJWT(metodo, url, token, cuerpo) {
  const opciones = { method: metodo, headers: {} };

  if (token) opciones.headers.Authorization = `Bearer ${token}`;
  if (cuerpo) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }

  const respuesta = await fetch(url, opciones);

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }

  return { status: respuesta.status, datos };
}

// El token completo no cabe en el estado, así que se muestran los primeros caracteres y el
// token entero se deja en la caja para copiarlo o pegarlo en otro equipo.
function pintarToken(token) {
  $('jwt-token').value = token || '';
  const estado = $('jwt-estado');

  if (token) {
    estado.textContent = `Con token (${token.slice(0, 12)}…)`;
    estado.className = 'estado con-sesion';
  } else {
    estado.textContent = 'Sin token';
    estado.className = 'estado sin-sesion';
  }
}

// textContent también aquí: el JSON trae el nombre del usuario y puede venir de cualquier lado.
function pintarRespuestaJWT(datos) {
  $('jwt-respuesta').textContent = datos === null ? '(sin JSON)' : JSON.stringify(datos, null, 2);
}

// El token no se puede leer como la cookie: se manda al servidor y él contesta si todavía sirve.
// Con esto la tarjeta 6 se actualiza sola y el contador de segundos baja en vivo.
async function refrescarToken() {
  const token = $('jwt-token').value.trim();
  const estado = $('jwt-estado');

  if (!token) {
    estado.textContent = 'Sin token';
    estado.className = 'estado sin-sesion';
    return;
  }

  const { status, datos } = await llamarJWT('GET', '/api/jwt/perfil', token);

  if (status === 200) {
    estado.textContent = `Con token · ${datos.mensaje} · vence en ${datos.expiraEnSegundos} s`;
    estado.className = 'estado con-sesion';
  } else {
    estado.textContent = `El token ya no sirve (${status})`;
    estado.className = 'estado sin-sesion';
  }
}

// Crear token es el mismo login, pero el servidor devuelve un token en vez de una cookie.
// Si sale bien, el token queda en la caja listo para los demás botones.
$('btn-jwt-crear').addEventListener('click', async () => {
  const cuerpo = { usuario: $('usuario').value, contrasena: $('contrasena').value };
  const { status, datos } = await llamarJWT('POST', '/api/jwt/login', null, cuerpo);
  anotar('POST', '/api/jwt/login', status, datos);
  pintarRespuestaJWT(datos);

  if (status === 200 && datos && datos.token) {
    pintarToken(datos.token);
  } else {
    pintarToken(null);
  }

  await listarTokens();
});

// Renovar no estira el mismo token: el servidor revoca el actual y firma otro con distinto jti
// y distinto vencimiento, para que el viejo ya no sirva.
$('btn-jwt-renovar').addEventListener('click', async () => {
  const { status, datos } = await llamarJWT('POST', '/api/jwt/renovar', $('jwt-token').value.trim());
  anotar('POST', '/api/jwt/renovar', status, datos);
  pintarRespuestaJWT(datos);

  if (status === 200 && datos && datos.token) pintarToken(datos.token);
  await listarTokens();
});

// Revocar es el logout del token: se guarda su jti y desde ese momento el servidor responde 401.
$('btn-jwt-revocar').addEventListener('click', async () => {
  const { status, datos } = await llamarJWT('POST', '/api/jwt/logout', $('jwt-token').value.trim());
  anotar('POST', '/api/jwt/logout', status, datos);
  pintarRespuestaJWT(datos);

  if (status === 200) pintarToken(null);
  await listarTokens();
});

// La tabla se reconstruye desde el servidor y se vacía antes de llenarla, igual que la de sesiones:
// si no, cada clic iría agregando filas repetidas.
async function listarTokens() {
  const { datos } = await llamarJWT('GET', '/api/jwt/diagnostico/tokens', null);
  const lista = datos ? datos.tokens : [];
  const cuerpo = $('tabla-tokens');
  cuerpo.textContent = '';

  if (lista.length === 0) {
    const fila = document.createElement('tr');
    const celda = document.createElement('td');
    celda.colSpan = 4;
    celda.textContent = '(sin tokens revocados)';
    fila.append(celda);
    cuerpo.append(fila);
    return;
  }

  for (const t of lista) {
    const fila = document.createElement('tr');
    const vence = t.expira ? new Date(t.expira).toLocaleTimeString() : '—';
    const revocado = t.revocadoEn ? new Date(t.revocadoEn).toLocaleTimeString() : '—';

    for (const valor of [t.jti, t.usuario, vence, revocado]) {
      const celda = document.createElement('td');
      celda.textContent = valor;
      fila.append(celda);
    }

    cuerpo.append(fila);
  }
}

$('btn-jwt-lista').addEventListener('click', listarTokens);

// Al entrar a la página no hay token y la tarjeta 6 saldría vacía. Se pide uno con el usuario del
// formulario para que el visitante lo vea desde el primer momento y pueda renovarlo o revocarlo.
async function crearTokenAlEntrar() {
  if ($('jwt-token').value.trim()) return;

  const cuerpo = { usuario: $('usuario').value, contrasena: $('contrasena').value };
  const { status, datos } = await llamarJWT('POST', '/api/jwt/login', null, cuerpo);

  if (status === 200 && datos && datos.token) {
    pintarToken(datos.token);
    pintarRespuestaJWT(datos);
  }
}

listarTokens();
crearTokenAlEntrar();

// Cada 3 segundos se vuelve a preguntar todo, igual que el botón: los contadores ("vence en N s")
// bajan solos y las tablas cambian sin pulsar nada. El botón sigue ahí para forzarlo al instante.
setInterval(refrescarTodo, 3000);
