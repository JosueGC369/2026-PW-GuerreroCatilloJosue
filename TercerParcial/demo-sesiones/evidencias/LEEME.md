# Evidencias · P-01 a P-16

Guarda aquí las capturas con **exactamente** estos nombres: `P-01.png` … `P-16.png`.
Las que son de terminal o de Workbench hay que tomarlas a mano; las de la página salen de
la propia demo (F12 → Network / Application).

Antes de empezar: `POST /api/logout` desde la página y confirma en Workbench que
`sessions` está vacía (o anota cuántas filas tiene). Así todas las capturas son
comparables.

| Archivo | Qué debe verse en la captura |
|---|---|
| `P-01.png` | Terminal con los 3 mensajes de `npm start` + la tarjeta 5 de la página con el JSON de `/api/config` |
| `P-02.png` | Network → `perfil` → Headers **sin** `Set-Cookie` + Application → Cookies vacío (401 en la bitácora) |
| `P-03.png` | Bitácora con los dos `401` (ana/mala y pepe/pepe12345) con el **mismo** mensaje |
| `P-04.png` | Dos capturas en una: Response Headers del login con `Set-Cookie` y Workbench con la fila nueva. Marca el **mismo** id en las dos |
| `P-05.png` | Network → `perfil` → Request Headers con `Cookie: connect.sid=…` + respuesta con `visitas` (1 y luego 2) |
| `P-06.png` | Página completa: tarjeta 1 en verde y tarjeta 4 con `(la tuya)` |
| `P-07.png` | Bitácora con el `403 · Eres ana, pero esta ruta es solo para admin` |
| `P-08.png` | Bitácora con los tres códigos (403 de ana, 401 sin sesión, 200 de admin) + la tabla llena |
| `P-09.png` | Dos capturas de `document.cookie`: con `httpOnly: true` → `''` y con `false` → `connect.sid=…` (regresa el valor a `true` al final) |
| `P-10.png` | Response Headers del logout (`Expires=Thu, 01 Jan 1970…`) + Workbench **sin** la fila |
| `P-11.png` | Atacante con `200 · Hola, Ana López` y, después del logout de la víctima, atacante con `401` |
| `P-12.png` | 1) Bitácora con `401 · Tu sesión venció` (`rolling: false`). 2) Dos capturas del estado con `rolling: true` mostrando que el contador se reinicia. 3) El `401` por inactividad |
| `P-13.png` | Login con `sesionAntes` **igual** a `sesionDespues` (`regenerarAlEntrar: false`) + atacante con estado de Ana |
| `P-14.png` | Login con `sesionAntes` **distinto** de `sesionDespues` (`regenerarAlEntrar: true`) + atacante con `401` |
| `P-15.png` | Estado tras reiniciar: con `mysql` sigue la sesión; con `memoria` la cookie sigue pero el servidor responde `401` |
| `P-16.png` | Terminal completa de `npm run probar` con las 21 `✔` y `21 de 21 pruebas pasaron` |

## Comandos útiles mientras tomas las capturas

```powershell
# En base/
npm start                  # servidor en http://localhost:4600
npm run probar             # 21 pruebas (usa demo_sesiones_pruebas, no toca tus datos)
npm run bd                 # vuelve a cargar demo_sesiones desde cero (BORRA los datos)
```

```sql
-- En MySQL Workbench, para P-04, P-05 y P-10
SELECT * FROM demo_sesiones.sessions;
```

> Recuerda: al cambiar `config.js` hay que **detener el servidor** (Ctrl+C) y volver a
> correr `npm start`. Al cambiar `demo.js` basta con **Ctrl+F5** en el navegador.
> Si cambias `httpOnly`, `rolling` o `regenerarAlEntrar`, regrésalos a sus valores
> originales (`true`, `false`, `true`) al terminar: así `npm run probar` sigue dando 21/21.
