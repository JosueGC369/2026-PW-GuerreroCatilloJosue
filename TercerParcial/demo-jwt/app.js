// La aplicación de la demo. server.js la arranca; las pruebas la arrancan con otras configuraciones.
// Lo que dice "(en clase)" lo programamos juntos, paso por paso. Mientras no esté, esa ruta responde 501.
const path = require('path');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { crearModeloUsuarios } = require('./modelos/usuarios.modelo');
const { crearModeloTokens } = require('./modelos/tokens.modelo');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const NOMBRE_COOKIE = 'connect.sid';

//si hay una sesion preexistente obtenerla del alamacen sino crearla
function todasLasSesiones(almacen){
  return new Promise((resolve, reject) => {
    const promesa = almacen.all((error, sesiones) => (error ? reject(error) : resolve(sesiones)));
    if (promesa && typeof promesa.then === 'function') promesa.then(resolve, reject);
  });
}

function crearApp(config, pool){
  const app = express();
  app.use(express.json());
  //primero debemos de obtener el modelo de la bd
  const usuarios = crearModeloUsuarios(pool);
  const tokens = crearModeloTokens(pool);

  // El secreto con el que se firma el token: si alguien lo conoce, puede firmar tokens falsos.
  const SECRETO_JWT = config.jwtSecreto || process.env.JWT_SECRET || 'secreto-jwt-solo-para-esta-demo';

  //aqui nosotros debemos de identificar la sesión sera por tabla en bd, o la sesión sera una cookie en memoria del navegador, o es una mezcla, sesion en memoria de servidor y por tabla en bd y cookie en navegador y bd
  const almacen = config.almacen === 'memoria'
    ? new session.MemoryStore()
    : new MySQLStore({createDatabaseTable: false, clearExpired: false}, pool);
  app.locals.almacen = almacen;

  app.use(
    session({
      name: NOMBRE_COOKIE,
      secret: process.env.SESSION_SECRET || 'secreto-solo.para-la-demo',
      store: almacen,
      resave: false,
      //no se crea la sesion ni la cookie
      saveUninitialized: false,
      rolling: config.rolling || false,
      cookie: {
        maxAge: config.maxAgeMs,
        httpOnly: config.httpOnly !== false,
        sameSite: config.sameSite || 'lax',
        secure: config.secure || false,
      },
    })
  );

  //necesitamos visualizar el id de la sesion para compararla en la pantalla.
  const cortoId = (id) => (id ? `${id.slice(0, 8)}...` : null);

  //nosotros estamos ocupando un middleware, el cual es el que se encarga de comunicar el back y el front, para ello nosotros debemos de obtener la sesión a partir de express, pero en cada petición debemos de devolver la sesión, para ello el atributo rolling, la extiende y aunque le hayamos dato false, no se puede confiar en que la expire, para ello debemos de identificarla y validarla en sus diferentes momentos
  function vencida(sesion){
    const desde = config.rolling ? sesion.ultimoUso : sesion.creada;
    return Date.now() - desde > config.maxAgeMs;
  }

  //mandar un 401 no se quien eres
  function requiereSesion(req, res, next){
    if(!req.session.usuario){
      return res.status(401).json({error: '401 · No has iniciado sesión (o tu sesión ya venció)'});
    }
    if(vencida(req.session)){
      return req.session.destroy(() => {
        res.clearCookie(NOMBRE_COOKIE);
        res.status(401).json({error: '401 · Tu sesión venció: vuelve a iniciar sesión'});
      });
    }
    req.session.ultimoUso = Date.now();
    next();
  }

  function requiereRol(rol){
    return (req, res, next) => {
      if(req.session.usuario.rol !== rol){
        return res.status(403).json({error: `403 · Eres ${req.session.usuario.usuario}, pero esta ruta es solo para ${rol}`});
      }
      next();
    };
  }

  //vamos a empezar a configurar las rutas

  app.get('/api/config', (req, res) => res.json(config));

  //vamos a crear una ruta para un perfil visitante y obtener su sesion a partir de una cookie

  app.post('/api/visita', (req, res) => {
    req.session.visitas = (req.session.visitas || 0) + 1;
    res.json({visitas: req.session.visitas, sesion: cortoId(req.sessionID)});
  });

  app.post('/api/login', async (req, res, next) => {
    try{
      const {usuario, contrasena} = req.body || {};
      const datos = await usuarios.verificar(usuario, contrasena);
      if(!datos) return res.status(401).json({error: 'Usuario o contraseña incorrectos'});

      //debemos de crear la sesion
      const antes = req.session.visitas !== undefined ? cortoId(req.sessionID) : null;
      const visitas = req.session.visitas || 0;

      //que vamos a guardar
      const guardar = () => {
        req.session.usuario = datos;
        req.session.visitas = visitas;
        req.session.creada = Date.now();
        req.session.ultimoUso = Date.now();
        req.session.save((error) => {
          if(error) return next(error);
          res.json({usuario: datos, sesionAntes: antes, sesionDespues: cortoId(req.sessionID)});
        });
      };

      if(config.regenerarAlEntrar){
        //vamos a regenerar la sesión
        req.session.regenerate((error) => (error ? next(error) : guardar()));
      }else{
        guardar();
      }
    }catch(error){
      next(error);
    }
  });

  app.post('/api/logout', (req, res, next) => {
    req.session.destroy((error) => {
      if(error) return next(error);
      res.clearCookie(NOMBRE_COOKIE);
      res.json({mensaje: 'Sesión cerrada: el servidor la borró'});
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

  app.get('/api/admin/reporte', requiereSesion, requiereRol('admin'), (req, res) => {
    res.json({reporte: 'Talleres: 3 · Inscritos: 57 · Cupo libre: 18'});
  });

  //para verificar que la sesion tiene el comportamiento deseado es necesario realizar una prueba unitaria al codigo
  app.get('/api/diagnostico/sesiones', async (req, res, next) => {
    try{
      const sesiones = await todasLasSesiones(almacen);
      const lista = Object.entries(sesiones || {}).map(([id, s]) => ({
        sesion: cortoId(id),
        esLaTuya: id === req.sessionID,
        usuario: s.usuario ? s.usuario.usuario : 'sin iniciar sesión',
        visitas: s.visitas || 0,
        expira: s.cookie && s.cookie.expires ? new Date(s.cookie.expires).toISOString() : null,
      }));
      res.json({almacen: config.almacen, sesiones: lista});
    }catch(error){
      next(error);
    }
  });

  // ---------- JWT: los mismos datos, pero firmados dentro de un token ----------

  // Firma un token con los datos del usuario. exp lo pone jsonwebtoken con jwtExpiraSeg
  // y jti es un id único por token, necesario para poder revocarlo después.
  function firmarToken(usuario){
    return jwt.sign(
      { sub: usuario.id, usuario: usuario.usuario, nombre: usuario.nombre, rol: usuario.rol },
      SECRETO_JWT,
      { algorithm: 'HS256', expiresIn: config.jwtExpiraSeg, jwtid: crypto.randomUUID() }
    );
  }

  // Sin cookie: el token llega en el encabezado Authorization: Bearer <token>.
  // Se verifica la firma, que no haya vencido y que su jti no esté en la lista negra.
  async function requiereJWT(req, res, next){
    try{
      const encabezado = req.headers.authorization || '';
      if(!encabezado.startsWith('Bearer ')){
        return res.status(401).json({error: '401 · Falta el token (Authorization: Bearer …)'});
      }
      const token = encabezado.slice('Bearer '.length);

      let datos;
      try{
        datos = jwt.verify(token, SECRETO_JWT, {algorithms: ['HS256']});
      }catch(error){
        if(error.name === 'TokenExpiredError'){
          return res.status(401).json({error: '401 · Token expirado: crea otro'});
        }
        return res.status(401).json({error: '401 · Token inválido'});
      }

      if(config.jwtRevocar && await tokens.estaRevocado(datos.jti)){
        return res.status(401).json({error: '401 · Token revocado: ya se cerró la sesión'});
      }

      req.jwt = datos;
      next();
    }catch(error){
      next(error);
    }
  }

  // Igual que requiereRol, pero con el rol que viene dentro del token.
  function requiereRolJWT(rol){
    return (req, res, next) => {
      if(req.jwt.rol !== rol){
        return res.status(403).json({error: `403 · Eres ${req.jwt.usuario}, pero esta ruta es solo para ${rol}`});
      }
      next();
    };
  }

  // Login: usuario y contraseña se validan contra MySQL y, si coinciden, se firma el token.
  app.post('/api/jwt/login', async (req, res, next) => {
    try{
      const {usuario, contrasena} = req.body || {};
      const datos = await usuarios.verificar(usuario, contrasena);
      if(!datos) return res.status(401).json({error: 'Usuario o contraseña incorrectos'});

      res.json({ token: firmarToken(datos), usuario: datos });
    }catch(error){
      next(error);
    }
  });

  // Perfil: todo lo que el servidor "sabe" viene del token, no de una tabla de sesiones.
  app.get('/api/jwt/perfil', requiereJWT, (req, res) => {
    res.json({
      mensaje: `Hola, ${req.jwt.nombre}`,
      rol: req.jwt.rol,
      jti: req.jwt.jti,
      expiraEnSegundos: Math.max(0, req.jwt.exp - Math.floor(Date.now() / 1000)),
    });
  });

  // Rol: el token dice quién eres, pero la ruta decide si puedes pasar (403).
  app.get('/api/jwt/admin/reporte', requiereJWT, requiereRolJWT('admin'), (req, res) => {
    res.json({reporte: 'Talleres: 3 · Inscritos: 57 · Cupo libre: 18'});
  });

  // Renovar: se revoca el token viejo y se firma uno nuevo con otro jti y otro exp.
  // No se "estira" el mismo token: así un token robado deja de servir.
  app.post('/api/jwt/renovar', requiereJWT, async (req, res, next) => {
    try{
      if(config.jwtRevocar){
        await tokens.revocar(req.jwt.jti, req.jwt.usuario, req.jwt.exp);
      }
      const datos = { id: req.jwt.sub, usuario: req.jwt.usuario, nombre: req.jwt.nombre, rol: req.jwt.rol };
      res.json({ token: firmarToken(datos), mensaje: 'Token renovado: el anterior quedó revocado' });
    }catch(error){
      next(error);
    }
  });

  // Logout de JWT: no hay sesión que destruir, así que se guarda el jti en la lista negra.
  app.post('/api/jwt/logout', requiereJWT, async (req, res, next) => {
    try{
      if(config.jwtRevocar){
        await tokens.revocar(req.jwt.jti, req.jwt.usuario, req.jwt.exp);
      }
      res.json({mensaje: 'Token revocado: queda en la lista negra', revocado: true});
    }catch(error){
      next(error);
    }
  });

  // Solo para la clase: la lista de tokens revocados que hay en MySQL.
  app.get('/api/jwt/diagnostico/tokens', async (req, res, next) => {
    try{
      const lista = await tokens.listar();
      res.json({
        tokens: lista.map((t) => ({
          jti: t.jti,
          usuario: t.usuario,
          expira: t.expira ? new Date(t.expira).toISOString() : null,
          revocadoEn: t.revocado_en ? new Date(t.revocado_en).toISOString() : null,
        })),
      });
    }catch(error){
      next(error);
    }
  });

  app.use(express.static(path.join(__dirname, 'public')));

  app.use('/api', (req, res) => res.status(404).json({error: 'Ruta no encontrada'}));

  app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({error: 'Error en el servidor'});
  });

  return app;
}

module.exports = {crearApp, NOMBRE_COOKIE};

//primera tarea Deberan de desarrollar una infografia sobre el uso de jwt para el inicio de sesion para el dia domingo 15 de noviembre

//segunda tarea deberan de desarrollar la implmenetación del codigo para realizar la autenticación y pruebas de sesiones conforme al documento para el archivo demo.js se entrega en vivo y en directo
