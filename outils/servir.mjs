/* Petit serveur statique pour developper et verifier.
   Usage : node outils/servir.mjs [port]                            */

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2]) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

createServer((requete, reponse) => {
  const chemin = decodeURIComponent(new URL(requete.url, 'http://x').pathname);
  /* normalize neutralise les « .. » : un serveur de developpement
     ne doit pas servir le disque entier. */
  let cible = join(racine, normalize(chemin).replace(/^(\.\.[/\\])+/, ''));
  if (existsSync(cible) && statSync(cible).isDirectory()) cible = join(cible, 'index.html');

  if (!cible.startsWith(racine) || !existsSync(cible)) {
    reponse.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    reponse.end('Introuvable');
    return;
  }

  reponse.writeHead(200, {
    'content-type': TYPES[extname(cible)] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(cible).pipe(reponse);
}).listen(port, () => console.log(`http://localhost:${port}`));
