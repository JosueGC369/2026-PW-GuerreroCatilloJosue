// La página solo hace fetch a la API. El navegador manda la cookie solo (misma página, mismo servidor).
const $ = (id) => document.getElementById(id);

// Una sola función para los ocho endpoints porque todos comparten el mismo contrato: JSON que entra, JSON que sale
// y un código HTTP. El código se lee de respuesta.status porque fetch no falla con un 401 ni con un 403, y datos
// queda en null si la respuesta no es JSON, para que la página no truene. No lleva credentials: 'include' porque
// la página y la API son el mismo origen (haría falta si la API estuviera en otro puerto o dominio).
async function llamar(metodo, url, cuerpo) {
  const opciones = { method: metodo };

  if (cuerpo !== undefined) {
    opciones.headers = { 'Content-Type': 'application/json' };
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

// El color sale del código: 2xx verde, 401 y 403 con su propio color, cualquier otro en rojo.
function claseDelCodigo(status) {
  if (status >= 200 && status < 300) return 'codigo ok';
  if (status === 401) return 'codigo e401';
  if (status === 403) return 'codigo e403';
  return 'codigo error';
}

// textContent y no innerHTML porque el JSON trae texto escrito por personas (nombres, usuarios) y con innerHTML se
// interpretaría como HTML: un nombre con <img onerror=...> ejecutaría código y podría robar la cookie si no fuera
// httpOnly. prepend junto con el <ol reversed> del HTML deja la respuesta más nueva arriba.
function anotar(metodo, url, status, datos) {
  const li = document.createElement('li');

  const codigo = document.createElement('span');
  codigo.className = claseDelCodigo(status);
  codigo.textContent = String(status);

  const titulo = document.createElement('span');
  titulo.textContent = ` ${metodo} ${url}`;

  const json = document.createElement('pre');
  json.textContent = datos === null ? '(sin JSON)' : JSON.stringify(datos, null, 2);

  li.append(codigo, titulo, json);
  $('bitacora').prepend(li);
}

// Hay que preguntarle a la API porque la cookie es httpOnly: el navegador la manda en cada petición pero
// document.cookie no la muestra, así que el único que sabe quién eres es el servidor. Lo que sí alcanza a leer el
// JavaScript se pinta en #cookie-js, y con httpOnly: true sale vacío aunque haya sesión.
async function mostrarEstado() {
  const { status, datos } = await llamar('GET', '/api/sesion');
  const estado = $('estado');

  if (status === 200 && datos && datos.usuario) {
    estado.textContent =
      `${datos.usuario.nombre} (${datos.usuario.rol}) · sesión ${datos.sesion} · ` +
      `vence en ${datos.expiraEnSegundos} s`;
    estado.className = 'estado con-sesion';
  } else {
    estado.textContent = 'Sin sesión (el servidor responde 401)';
    estado.className = 'estado sin-sesion';
  }

  $('cookie-js').textContent = document.cookie || '(vacío)';
}

// La tabla se reconstruye entera desde el servidor porque él es la fuente de verdad (las sesiones cambian desde
// otras pestañas o desde MySQL). El <tbody> se vacía antes de llenarlo: si no, cada clic iría agregando filas y la
// tabla se duplicaría. La fecha ISO de "expira" se pasa a hora local con toLocaleString.
async function mostrarTabla() {
  const { datos } = await llamar('GET', '/api/diagnostico/sesiones');
  const cuerpo = $('tabla-sesiones');

  cuerpo.textContent = '';

  if (!datos) {
    $('donde').textContent = 'No se pudo consultar el diagnóstico.';
    return;
  }

  $('donde').textContent = datos.almacen === 'mysql'
    ? 'En MySQL, tabla sessions (sobreviven a que reinicies el servidor).'
    : 'En la memoria del servidor (se pierden al reiniciar).';

  const sesiones = datos.sesiones || [];

  if (sesiones.length === 0) {
    const fila = document.createElement('tr');
    const celda = document.createElement('td');
    celda.colSpan = 4;
    celda.textContent = '(sin sesiones)';
    fila.append(celda);
    cuerpo.append(fila);
    return;
  }

  for (const sesion of sesiones) {
    const fila = document.createElement('tr');
    if (sesion.esLaTuya) fila.className = 'tuya';

    const celdas = [
      sesion.sesion + (sesion.esLaTuya ? ' (la tuya)' : ''),
      sesion.usuario,
      String(sesion.visitas),
      sesion.expira ? new Date(sesion.expira).toLocaleString() : '—',
    ];

    for (const texto of celdas) {
      const celda = document.createElement('td');
      celda.textContent = texto;
      fila.append(celda);
    }

    cuerpo.append(fila);
  }
}

// Casi toda acción cambia el estado y la tabla (login, logout, visita), así que las dos se piden juntas en un solo
// lugar y ninguna queda mostrando datos viejos.
async function refrescarTodo() {
  await Promise.all([mostrarEstado(), mostrarTabla()]);
}

// preventDefault porque sin él el navegador envía el formulario, recarga la página y se pierde la bitácora; la
// gracia de la demo es ver la respuesta sin recargar.
$('form-login').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const cuerpo = {
    usuario: $('usuario').value,
    contrasena: $('contrasena').value,
  };

  const { status, datos } = await llamar('POST', '/api/login', cuerpo);
  anotar('POST', '/api/login', status, datos);

  await refrescarTodo();
});

// Un solo listener para todos los botones con data-url: dataset convierte data-metodo y data-url en
// boton.dataset.metodo y boton.dataset.url, y si mañana se agrega otro botón en el HTML funciona sin tocar esto.
for (const boton of document.querySelectorAll('button[data-url]')) {
  boton.addEventListener('click', async () => {
    const metodo = boton.dataset.metodo;
    const url = boton.dataset.url;

    const { status, datos } = await llamar(metodo, url);
    anotar(metodo, url, status, datos);

    await refrescarTodo();
  });
}

// El evento es change y no input porque solo interesa cuando ya se eligió otro usuario: le pone su contraseña de
// ejemplo, <usuario>12345.
$('usuario').addEventListener('change', () => {
  $('contrasena').value = `${$('usuario').value}12345`;
});

// Estos dos botones solo repiten lo que ya hacen otras funciones.
$('btn-refrescar').addEventListener('click', refrescarTodo);
$('btn-sesiones').addEventListener('click', mostrarTabla);

// No hace falta esperar DOMContentLoaded porque el <script> está al final del <body>: cuando este archivo se
// ejecuta, todos los elementos de arriba ya existen. JSON.stringify con 2 espacios deja la sangría que el <pre> respeta.
async function mostrarConfig() {
  const { datos } = await llamar('GET', '/api/config');
  $('config').textContent = datos === null ? '(no disponible)' : JSON.stringify(datos, null, 2);
}

// Arranque: primero la configuración, que no depende de la sesión, y luego el estado y la tabla.
(async () => {
  await mostrarConfig();
  await refrescarTodo();
})();
