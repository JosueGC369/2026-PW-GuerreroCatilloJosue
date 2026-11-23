// Lista negra de tokens. Un JWT no se puede "borrar": el servidor deja de aceptarlo cuando
// guarda su jti (el id único del token) en esta tabla.
function crearModeloTokens(pool) {
  // Guarda el jti para que ese token ya no se acepte aunque su firma siga siendo válida.
  async function revocar(jti, usuario, exp) {
    await pool.query(
      'INSERT INTO tokens_revocados (jti, usuario, expira) VALUES (?, ?, FROM_UNIXTIME(?))',
      [jti, usuario, exp]
    );
  }

  // Pregunta si el jti ya está en la lista negra. String(jti || '') evita comparar con undefined.
  async function estaRevocado(jti) {
    const [filas] = await pool.query(
      'SELECT 1 FROM tokens_revocados WHERE jti = ?',
      [String(jti || '')]
    );
    return filas.length > 0;
  }

  // La lista para la tabla de la página: solo para la clase.
  async function listar() {
    const [filas] = await pool.query(
      'SELECT jti, usuario, expira, revocado_en FROM tokens_revocados ORDER BY revocado_en DESC, jti'
    );
    return filas;
  }

  return { revocar, estaRevocado, listar };
}

module.exports = { crearModeloTokens };
