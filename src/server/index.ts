/** Point d'entrée du serveur — ouvre la base, monte l'API, écoute. */
import { openDb } from "./db.js";
import { Repository } from "./repository.js";
import { createApp } from "./api.js";

const PORT = Number(process.env.PORT ?? 3000);
const DB_PATH = process.env.DB_PATH ?? "data/pointage.db";

const db = openDb(DB_PATH);
const repo = new Repository(db);
const app = createApp(repo);

const server = app.listen(PORT, () => {
  console.log(`Pointage BTP — API + PWA sur http://localhost:${PORT}`);
  console.log(`Base de données : ${DB_PATH}`);
});

function shutdown(signal: string): void {
  console.log(`\n${signal} reçu, arrêt propre…`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
