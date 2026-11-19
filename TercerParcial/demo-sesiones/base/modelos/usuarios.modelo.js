// Consultas a la tabla usuarios. Siempre con ? (consulta parametrizada), nunca
// pegando texto en el SQL: así una contraseña como ' OR 1=1 -- no cambia la consulta.
const bcrypt = require('bcryptjs');

function crearModeloUsuarios(pool) {
  // Regresa el usuario (sin el hash) si la contraseña es correcta, o null si no.
  async function verificar(usuario, contrasena) {
    // Sin datos no se consulta: evita mandar undefined a MySQL.
    if (!usuario || !contrasena) return null;

    const [filas] = await pool.query(
      'SELECT id, usuario, nombre, rol, contrasena_hash FROM usuarios WHERE usuario = ? LIMIT 1',
      [usuario]
    );

    const fila = filas[0];
    if (!fila) return null;

    // bcrypt.compare vuelve a calcular el hash con la sal que ya trae guardada.
    // Nunca se compara la contraseña en texto plano.
    const coincide = await bcrypt.compare(contrasena, fila.contrasena_hash);
    if (!coincide) return null;

    // El hash no sale de aquí: la página y la consola no tienen por qué verlo.
    const { contrasena_hash, ...datos } = fila;
    return datos;
  }

  return { verificar };
}

module.exports = { crearModeloUsuarios };
