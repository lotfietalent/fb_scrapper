// ============================================================
// LOGGER SIMPLE — Affiche date/heure + niveau + message
// Ne logue jamais les secrets ou données sensibles
// ============================================================

const pad = (n) => String(n).padStart(2, '0');

function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fmt(level, msg, data) {
  const line = `[${timestamp()}] [${level}] ${msg}`;
  if (data !== undefined) {
    // Ne pas loguer les objets contenant "key" ou "credential"
    const safe = JSON.stringify(data, (k, v) =>
      ['private_key', 'credential', 'password', 'token'].includes(k) ? '***' : v
    );
    return `${line} ${safe}`;
  }
  return line;
}

export const logger = {
  info:  (msg, data) => console.log(fmt('INFO ', msg, data)),
  warn:  (msg, data) => console.warn(fmt('WARN ', msg, data)),
  error: (msg, data) => console.error(fmt('ERROR', msg, data)),
  debug: (msg, data) => {
    if (process.env.DEBUG === 'true') console.log(fmt('DEBUG', msg, data));
  },
};

