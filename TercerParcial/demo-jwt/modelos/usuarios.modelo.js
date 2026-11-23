// Consultas a la tabla usuarios. Siempre con ? (consulta parametrizada), nunca pegando texto en el SQL.
const bcrypt = require('bcryptjs');

function crearModeloUsuarios(pool) {
  // Regresa el usuario (sin el hash) si la contraseña es correcta, o null si no.
  async function verificar(usuario, contrasena) {
    // Paso 2 (en clase)
    const [filas] = await pool.query(
      'SELECT id, usuario, nombre, rol, contrasena_hash FROM usuarios WHERE usuario = ? LIMIT 1',
      [usuario]
    );

    const fila = filas[0];
    if (!fila || !contrasena) return null;

    const coincide = await bcrypt.compare(contrasena, fila.contrasena_hash);
    if (!coincide) return null;

    const { contrasena_hash, ...datos } = fila;
    return datos;
  }

  return { verificar };
}

module.exports = { crearModeloUsuarios };
