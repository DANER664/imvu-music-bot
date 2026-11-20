# Bot de música para IMVU — Render gratis

Bot desde cero con Node.js + `imvu.js` 0.1.0, listo para desplegar en Render sin PC.

## Lo que hace esta v1 (honesto)

- Escucha el chat de tu sala y responde a los 8 comandos que pediste.
- Busca canciones en YouTube con `yt-search` y maneja cola / historial.
- Anuncia en la sala el título y el enlace de YouTube para que todos lo abran.

**Lo que NO hace todavía:** `imvu.js` 0.1.0 no tiene una función para transmitir audio dentro de IMVU. Por eso esta v1 no inyecta el sonido en la sala como Discord. Es el modelo de la mayoría de bots de IMVU: la sala usa YouTube / radio y el bot coordina qué suena y en qué orden.

Si después quieres audio real dentro de la sala, eso sería una v2 aparte y hay que validar si tu sala lo soporta (`supports_youtube` / `has_audio`).

## Comandos

| Comando | Qué hace |
|---|---|
| `!play <canción>` | Busca y reproduce al instante. Sin canción, reanuda si estaba en pausa |
| `!add <canción>` | Agrega a la cola |
| `!playlist` | Muestra la actual + cola (hasta 10) |
| `!next` | Salta a la siguiente |
| `!prev` | Regresa a la anterior |
| `!stop` | Detiene todo y limpia la cola |
| `!pause` | Pausa la actual |
| `!clean` | Limpia solo la cola |
| `!help` | Muestra los comandos |

## Archivos

- `index.js` — el bot + un mini servidor HTTP (`/` y `/health`) para Render
- `package.json` — dependencias: `imvu.js`, `yt-search`
- `render.yaml` — configuración para Render
- `.env.example` — ejemplo de variables (nunca subas tu token real a GitHub)

## Paso 1 — Consigue el token (sin PC, desde el celular)

1. Entra a https://imvu.js.org y regístrate.
2. Ahí te dan el token del bot. Es la llave de tu sala.
3. **No me lo pases por chat y no lo pegues en el código.** Lo vas a poner directo en Render como variable secreta.
4. Importante: según la propia librería, esto solo funciona para salas que son tuyas, no para salas de otra persona.

## Paso 2 — Sube el código a GitHub (desde el celular)

1. Crea una cuenta en https://github.com si no tienes.
2. Crea un repositorio nuevo, por ejemplo `imvu-music-bot`, en **privado** mejor.
3. Sube estos archivos con `Add file > Upload files`: `index.js`, `package.json`, `render.yaml`, `.gitignore`. No subas `node_modules` ni ningún archivo `.env` con el token.

## Paso 3 — Despliega en Render gratis

1. Crea una cuenta en https://render.com (el plan gratis no pide tarjeta).
2. `New + > Web Service` > conecta tu GitHub y elige el repositorio `imvu-music-bot`.
3. Configura:
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Instance Type:** `Free`
- Render detecta Node.js solo y te da una URL como `tu-bot.onrender.com`.
4. En **Environment > Environment Variables**, agrega:
- `IMVU_TOKEN` = tu token de imvu.js.org
- `BOT_OUTFIT` = `80,191`
- `BOT_SEAT` = `-1 0`
5. Dale a `Create Web Service` / `Deploy`. Render instala, arranca y te da la URL.

El plan gratis te da 750 horas al mes, suficiente para un servicio.

## Paso 4 — Evita que se duerma (opcional pero recomendado)

El plan gratis de Render se apaga después de 15 minutos sin tráfico y tarda 30 a 60 segundos en despertar.

Para mantenerlo despierto:

1. Crea una cuenta gratis en https://uptimerobot.com
2. Crea un monitor HTTP(s) a tu URL de Render + `/health`, por ejemplo `https://tu-bot.onrender.com/health`, cada 5 o 10 minutos.
3. Esa visita es tráfico y lo mantiene vivo. Una guía de Render recomienda justo eso: poner un monitor de UptimeRobot que haga ping cada 10 minutos.

Si aun así se duerme en horas de poco uso, la solución real es el plan Starter de $7/mes, que ya no se duerme.

## Cómo probar

1. Entra a tu sala con tu cuenta normal.
2. El bot debe aparecer conectado y decir que está en línea.
3. Escribe en el chat de la sala:
- `!play shakira bzrp`
- `!add bad bunny daddy yankee`
- `!playlist`
- `!next`
- `!pause` y luego `!play` para reanudar
4. Revisa en Render `Logs` si algo falla. Si dice `FALTA IMVU_TOKEN`, es que la variable no quedó guardada.

## Si algo falla

- **Bot no entra a la sala:** revisa que el token esté bien copiado en Render y que la sala sea tuya.
- **No encuentra canciones:** YouTube a veces limita búsquedas. Prueba con otro nombre o espera un poco.
- **Se desconecta solo:** es el sueño del plan gratis. Revisa UptimeRobot y que `/health` responda `{"ok":true,...}`.

## Seguridad

- Usa una cuenta de IMVU dedicada para el bot, no tu cuenta principal.
- Los bots no son oficiales de IMVU. Úsalo en tu propia sala y sin spam, para no arriesgar la cuenta.
- Nunca compartas el token. Si se filtra, genera uno nuevo en imvu.js.org y actualízalo en Render.
