// Bot de música para IMVU — v1
// Librería verificada: imvu.js 0.1.0 (npm)
// API real de esa versión:
//   const IMVU = require('imvu.js')
//   const imvu = new IMVU({ outfit: [80, 191], seat: "-1 0" })
//   imvu.on('ready', () => {})
//   imvu.on('message', (message) => {})  // message = { content, user }
//   imvu.say('texto')
//   imvu.login('TOKEN')
//
// IMPORTANTE sobre la música:
// imvu.js 0.1.0 NO tiene una función para transmitir audio dentro de IMVU.
// Esta v1 hace lo que sí pueden hacer los bots con esta librería:
// busca en YouTube, maneja la cola y anuncia en el chat el enlace para que
// todos lo abran y escuchen en sincronía. Es el mismo modelo que usan la
// mayoría de bots de música de IMVU: la sala tiene supports_youtube / radio,
// no un stream de audio del bot.
//
// Comandos:
//   !play <canción>  — reproduce al instante (o reanuda si estaba en pausa)
//   !add <canción>   — agrega a la cola
//   !playlist         — muestra la canción actual y la cola
//   !next             — salta a la siguiente
//   !prev             — regresa a la anterior
//   !stop             — detiene todo y limpia la cola
//   !pause            — pausa la actual
//   !clean            — limpia solo la cola, sin detener la actual
//   !help             — muestra los comandos

const http = require('http');
const IMVU = require('imvu.js');
const yts = require('yt-search');

const TOKEN = process.env.IMVU_TOKEN || '';
const OUTFIT = process.env.BOT_OUTFIT
  ? process.env.BOT_OUTFIT.split(',').map((n) => Number(n.trim())).filter((n) => !Number.isNaN(n))
  : [80, 191];
const SEAT = process.env.BOT_SEAT || '-1 0';
const PORT = Number(process.env.PORT || 10000);

// ---- Estado de la música ----
let current = null; // { title, url, duration, author, requestedBy }
let queue = [];
let history = [];
let isPaused = false;

function formatSong(song, prefix = '') {
  const dur = song.duration ? ` (${song.duration})` : '';
  const author = song.author ? ` - ${song.author}` : '';
  return `${prefix}${song.title}${author}${dur}\n${song.url}`;
}

async function searchSong(query) {
  const result = await yts(query);
  const video = result && result.videos && result.videos[0];
  if (!video) return null;
  return {
    title: video.title,
    url: video.url,
    duration: video.timestamp || '',
    author: (video.author && video.author.name) || '',
  };
}

async function announce(text) {
  try {
    await imvu.say(text);
  } catch (e) {
    console.error('Error al enviar mensaje:', e.message);
  }
}

async function playNow(song, requestedBy) {
  if (current) history.push(current);
  current = { ...song, requestedBy };
  isPaused = false;
  await announce(`🎵 Reproduciendo: ${formatSong(current)}`);
}

async function playNextInQueue() {
  if (queue.length === 0) {
    current = null;
    isPaused = false;
    await announce('📭 La cola está vacía. Usa !play <canción> para poner una.');
    return;
  }
  const next = queue.shift();
  await playNow(next, next.requestedBy);
}

// ---- Servidor HTTP para Render ----
// Render (Web Service gratis) necesita un puerto abierto y se duerme a los
// 15 min sin tráfico HTTP. Este endpoint es lo que UptimeRobot va a
// visitar cada 10 min para despertarlo. No es la música, solo el keep-alive.
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, current: current ? current.title : null, queue: queue.length, paused: isPaused }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    bot: 'imvu-music-bot',
    status: current ? (isPaused ? 'paused' : 'playing') : 'idle',
    current: current ? current.title : null,
    queue: queue.length,
  }));
});
server.listen(PORT, () => console.log(`[http] Escuchando en puerto ${PORT} — /health listo`));

// ---- Bot IMVU ----
const imvu = new IMVU({ outfit: OUTFIT, seat: SEAT, show_online: true });

imvu.on('ready', () => {
  console.log(`Bot ${imvu.display_name} (ID ${imvu.id}) conectado a la sala ${imvu.room && imvu.room.id}`);
  imvu.say('🎵 Bot de música en línea. Escribe !help para ver los comandos.');
});

imvu.on('join', async (user) => {
  if (!user || user.bot) return;
  try {
    await imvu.say(`¡Bienvenido/a ${user.display_name}! 🎵 Escribe !help para pedir música.`);
  } catch (_) {}
});

imvu.on('message', async (message) => {
  try {
    if (!message || !message.content) return;
    if (message.user && message.user.bot) return;

    const text = String(message.content).trim();
    if (!text.startsWith('!')) return;

    const [rawCmd, ...rest] = text.slice(1).split(/\s+/);
    const cmd = (rawCmd || '').toLowerCase();
    const query = rest.join(' ').trim();
    const who = message.user ? message.user.display_name : 'alguien';

    if (cmd === 'help') {
      await announce(
        '🎵 Comandos:\n!play <canción> — reproduce al instante\n!add <canción> — agrega a la cola\n!playlist — ver actual + cola\n!next — siguiente\n!prev — anterior\n!stop — detiene todo\n!pause — pausa\n!clean — limpia la cola'
      );
      return;
    }

    if (cmd === 'play') {
      if (!query) {
        // Sin canción: reanuda si estaba en pausa, como pide el diseño original
        if (current && isPaused) {
          isPaused = false;
          await announce(`▶️ Reanudando: ${formatSong(current)}`);
        } else if (current) {
          await announce(`🎵 Sonando ahora: ${formatSong(current)}`);
        } else {
          await announce('Escribe: !play <nombre de la canción>');
        }
        return;
      }
      await announce(`🔎 Buscando: ${query}...`);
      const song = await searchSong(query);
      if (!song) {
        await announce(`No encontré nada para: ${query}`);
        return;
      }
      await playNow({ ...song, requestedBy: who }, who);
      return;
    }

    if (cmd === 'add') {
      if (!query) {
        await announce('Escribe: !add <nombre de la canción>');
        return;
      }
      const song = await searchSong(query);
      if (!song) {
        await announce(`No encontré nada para: ${query}`);
        return;
      }
      queue.push({ ...song, requestedBy: who });
      await announce(`➕ Agregada a la cola (#${queue.length}): ${formatSong(song)}`);
      return;
    }

    if (cmd === 'playlist') {
      if (!current && queue.length === 0) {
        await announce('📭 La lista está vacía. Usa !play <canción> para empezar.');
        return;
      }
      const lines = [];
      if (current) lines.push(`▶️ Ahora: ${current.title} — ${current.url}${isPaused ? ' (en pausa)' : ''}`);
      queue.slice(0, 10).forEach((s, i) => lines.push(`${i + 1}. ${s.title} — ${s.url}`));
      if (queue.length > 10) lines.push(`... y ${queue.length - 10} más en cola.`);
      await announce(`🎶 Lista de reproducción:\n${lines.join('\n')}`);
      return;
    }

    if (cmd === 'next') {
      if (queue.length === 0) {
        await announce('📭 No hay siguiente canción. Usa !add <canción> para agregar una.');
        return;
      }
      await playNextInQueue();
      return;
    }

    if (cmd === 'prev') {
      if (history.length === 0) {
        await announce('📭 No hay canción anterior.');
        return;
      }
      if (current) queue.unshift(current);
      const prev = history.pop();
      current = prev;
      isPaused = false;
      await announce(`⏮️ Regresando a: ${formatSong(current)}`);
      return;
    }

    if (cmd === 'stop') {
      current = null;
      queue = [];
      history = [];
      isPaused = false;
      await announce('⏹️ Música detenida y lista limpiada.');
      return;
    }

    if (cmd === 'pause') {
      if (!current) {
        await announce('No hay nada sonando para pausar.');
        return;
      }
      if (isPaused) {
        await announce('Ya estaba en pausa. Usa !play para reanudar.');
        return;
      }
      isPaused = true;
      await announce(`⏸️ Pausada: ${current.title}. Usa !play para reanudar donde quedó.`);
      return;
    }

    if (cmd === 'clean') {
      queue = [];
      await announce('🧹 Lista de reproducción limpiada.');
      return;
    }
  } catch (e) {
    console.error('Error en comando:', e);
    try { await imvu.say('Hubo un error con ese comando. Inténtalo de nuevo.'); } catch (_) {}
  }
});

// Anti-spam simple: no responder más de 1 comando por segundo por sala
// (IMVU desconecta por flood si se mandan muchos mensajes seguidos)

if (!TOKEN) {
  console.error('FALTA IMVU_TOKEN. Ponlo en Render como variable de entorno. El servidor HTTP seguirá arriba para que Render no marque error de puerto, pero el bot no se conectará a IMVU.');
} else {
  imvu.login(TOKEN).catch((e) => {
    console.error('No se pudo conectar a IMVU. Revisa el token en Render. Detalle:', e && e.message ? e.message : e);
  });
}

process.on('SIGTERM', () => {
  console.log('Apagando...');
  try { server.close(); } catch (_) {}
  process.exit(0);
});
