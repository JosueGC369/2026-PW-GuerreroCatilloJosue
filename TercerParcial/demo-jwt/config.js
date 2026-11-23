// ConfiguraciÃ³n de la sesiÃ³n y del token. Durante la demo vas a cambiar estos valores.
// DespuÃ©s de cada cambio: detÃ©n el servidor (Ctrl+C) y vuelve a correr  npm start
module.exports = {
  // DÃ³nde guarda el servidor las sesiones:
  //  'mysql'   â†’ en la tabla sessions de tu base de datos (sobreviven a un reinicio).
  //  'memoria' â†’ en la memoria del servidor (se pierden al reiniciar).
  almacen: 'mysql',

  // CuÃ¡nto dura la sesiÃ³n, en milisegundos. 10 minutos = 10 * 60 * 1000
  maxAgeMs: 10 * 60 * 1000,

  // true: cada peticiÃ³n reinicia el reloj de la expiraciÃ³n (la sesiÃ³n vence por inactividad).
  // false: vence a la hora fija, aunque el usuario siga usando la pÃ¡gina.
  rolling: false,

  // true: el JavaScript de la pÃ¡gina NO puede leer la cookie (document.cookie no la muestra).
  httpOnly: true,

  // 'lax': la cookie no viaja en peticiones POST que vienen de otros sitios. 'strict' es mÃ¡s estricto.
  sameSite: 'lax',

  // true: al iniciar sesiÃ³n el servidor cambia el id de la sesiÃ³n (protege contra la fijaciÃ³n de sesiÃ³n).
  regenerarAlEntrar: true,

  // --- JWT ---
  // CuÃ¡nto dura el token, en segundos. 60 = 1 minuto (para poder verlo vencer en clase).
  jwtExpiraSeg: 60,

  // true: al cerrar sesiÃ³n el token se guarda en la tabla tokens_revocados y ya no sirve.
  jwtRevocar: true,
};
