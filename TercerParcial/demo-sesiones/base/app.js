// La aplicación de la demo. server.js la arranca; las pruebas la arrancan con
// otras configuraciones, por eso recibe config y pool en vez de leerlos aquí.
const path = require('path');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { crearModeloUsuarios } = require('./modelos/usuarios.modelo');

const NOMBRE_COOKIE = 'connect.sid';

// Los dos almacenes de express-session no devuelven las sesiones igual:
// MemoryStore.all() usa callback y MySQLStore puede usar callback o promesa.
// Esta función normaliza los tres casos a una promesa.
function todasLasSesiones(almacen) {
  return new Promise((resolve, reject) => {
    const resultado = almacen.all((error, sesiones) => (error ? reject(error) : resolve(sesiones)));
    if (resultado && typeof resultado.then === 'function') resultado.then(resolve, reject);
  });
}

function crearApp(config, pool) {
  const app = express();
  app.use(express.json());
  const usuarios = crearModeloUsuarios(pool);

  // El almacén decide dónde vive la sesión: en la tabla sessions de MySQL
  // (sobrevive a un reinicio) o en la memoria del proceso (se pierde al reiniciar).
  const almacen = config.almacen === 'memoria'
    ? new session.MemoryStore()
    : new MySQLStore({ createDatabaseTable: false, clearExpired: false }, pool);
  app.locals.almacen = almacen;

  app.use(
    session({
      name: NOMBRE_COOKIE,
      secret: process.env.SESSION_SECRET || 'secreto-solo-para-la-demo',
      store: almacen,
      resave: false,
      // No crear sesión (ni cookie) si nadie escribió nada en ella: por eso un
      // 401 no deja cookie en el navegador.
      saveUninitialized: false,
      // rolling: true reinicia el reloj en cada petición (vence por inactividad).
      rolling: Boolean(config.rolling),
      cookie: {
        // config.js lo llama maxAgeMs; express-session lo llama maxAge. Son el mismo número.
        maxAge: config.maxAgeMs,
        httpOnly: config.httpOnly !== false,
        sameSite: config.sameSite || 'lax',
        secure: Boolean(config.secure),
      },
    })
  );

  // El id completo nunca se manda a la página: solo sus primeros 8 caracteres.
  const cortoId = (id) => (id ? `${id.slice(0, 8)}…` : null);

  // express-session expira la cookie en el navegador, pero no decide por sí solo
  // si la sesión sigue siendo válida en el servidor. Por eso la fecha se guarda
  // en la propia sesión y se compara aquí, en cada petición protegida.
  function vencida(sesion) {
    const desde = config.rolling ? sesion.ultimoUso : sesion.creada;
    return Date.now() - desde > config.maxAgeMs;
  }

  // 401: no sé quién eres. Se responde igual si no hay sesión o si ya venció,
  // salvo el mensaje, que en clase sirve para distinguir los dos casos.
  function requiereSesion(req, res, next) {
    if (!req.session.usuario) {
      return res.status(401).json({ error: '401 · No has iniciado sesión (o tu sesión ya venció)' });
    }
    if (vencida(req.session)) {
      return req.session.destroy((error) => {
        if (error) return next(error);
        res.clearCookie(NOMBRE_COOKIE);
        res.status(401).json({ error: '401 · Tu sesión venció: vuelve a iniciar sesión' });
      });
    }
    req.session.ultimoUso = Date.now();
    next();
  }

  // 403: sé quién eres, pero no puedes. Va después de requiereSesion, así que
  // aquí ya se sabe que hay un usuario.
  function requiereAdmin(req, res, next) {
    if (req.session.usuario.rol !== 'admin') {
      return res.status(403).json({
        error: `403 · Eres ${req.session.usuario.usuario}, pero esta ruta es solo para admin`,
      });
    }
    next();
  }

  app.get('/api/config', (req, res) => res.json(config));

  // /api/visita no pide sesión: sirve para crear una sesión "vacía" y así poder
  // demostrar la fijación de sesión (P-13) y el cambio de id al entrar (P-14).
  app.post('/api/visita', (req, res) => {
    req.session.visitas = (req.session.visitas || 0) + 1;
    res.json({ visitas: req.session.visitas, sesion: cortoId(req.sessionID) });
  });

  app.post('/api/login', async (req, res, next) => {
    try {
      const { usuario, contrasena } = req.body || {};
      const datos = await usuarios.verificar(usuario, contrasena);

      // El mismo mensaje para "no existe" y "contraseña mal": si dijera cuál de
      // los dos falló, se podría averiguar qué usuarios existen.
      if (!datos) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

      // "antes" solo tiene sentido si ya había una sesión (por ejemplo la que
      // plantó un atacante). Si la sesión es nueva, es null.
      const antes = req.session.visitas !== undefined ? cortoId(req.sessionID) : null;
      const visitas = req.session.visitas || 0;

      const guardar = () => {
        req.session.usuario = datos;
        req.session.visitas = visitas;
        req.session.creada = Date.now();
        req.session.ultimoUso = Date.now();
        req.session.save((error) => {
          if (error) return next(error);
          res.json({
            usuario: datos,
            sesionAntes: antes,
            sesionDespues: cortoId(req.sessionID),
          });
        });
      };

      // regenerarAlEntrar cambia el id de la sesión justo al entrar: así, una
      // cookie plantada antes del login deja de servir (protección contra
      // fijación de sesión). Con false, el id se conserva y el ataque funciona.
      if (config.regenerarAlEntrar) {
        req.session.regenerate((error) => (error ? next(error) : guardar()));
      } else {
        guardar();
      }
    } catch (error) {
      next(error);
    }
  });

  // Logout destruye la sesión en el ALMACÉN, no solo en el navegador: la cookie
  // borrada evita el viaje, pero lo importante es que el servidor ya la olvidó.
  app.post('/api/logout', (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie(NOMBRE_COOKIE);
      res.json({ mensaje: 'Sesión cerrada: el servidor la borró' });
    });
  });

  app.get('/api/sesion', requiereSesion, (req, res) => {
    const desde = config.rolling ? req.session.ultimoUso : req.session.creada;
    res.json({
      usuario: req.session.usuario,
      sesion: cortoId(req.sessionID),
      expiraEnSegundos: Math.max(0, Math.round((desde + config.maxAgeMs - Date.now()) / 1000)),
    });
  });

  app.get('/api/perfil', requiereSesion, (req, res) => {
    req.session.visitas = (req.session.visitas || 0) + 1;
    res.json({
      mensaje: `Hola, ${req.session.usuario.nombre}`,
      rol: req.session.usuario.rol,
      visitas: req.session.visitas,
    });
  });

  app.get('/api/admin/reporte', requiereSesion, requiereAdmin, (req, res) => {
    res.json({ reporte: 'Talleres: 3 · Inscritos: 57 · Cupo libre: 18' });
  });

  // Solo para la clase: un servidor real nunca expone las sesiones de todos.
  app.get('/api/diagnostico/sesiones', async (req, res, next) => {
    try {
      const sesiones = await todasLasSesiones(almacen);
      const lista = Object.entries(sesiones || {}).map(([id, guardada]) => ({
        sesion: cortoId(id),
        // Comparar contra req.sessionID es lo que permite marcar "la tuya".
        esLaTuya: id === req.sessionID,
        usuario: guardada.usuario ? guardada.usuario.usuario : 'sin iniciar sesión',
        visitas: guardada.visitas || 0,
        expira: guardada.cookie && guardada.cookie.expires
          ? new Date(guardada.cookie.expires).toISOString()
          : null,
      }));
      res.json({ almacen: config.almacen, sesiones: lista });
    } catch (error) {
      next(error);
    }
  });

  app.use(express.static(path.join(__dirname, 'public')));

  // Cualquier otra ruta /api/... es un 404 con JSON, no la página de inicio.
  app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  // Manejador de errores al final: express lo reconoce por tener 4 argumentos.
  app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  });

  return app;
}

module.exports = { crearApp, NOMBRE_COOKIE };
