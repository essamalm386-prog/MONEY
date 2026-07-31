/** Point d'entrée du serveur — ouvre la base, monte l'API, écoute. */
import { networkInterfaces } from "node:os";
import { openDb } from "./db.js";
import { Repository } from "./repository.js";
import { createApp } from "./api.js";
import { hashPassword } from "./auth.js";
import { newId, nowISO } from "./ids.js";

const PORT = Number(process.env.PORT ?? 3000);
const DB_PATH = process.env.DB_PATH ?? "data/pointage.db";

const db = openDb(DB_PATH);
const repo = new Repository(db);

// Premier démarrage : crée le compte administrateur initial.
if (repo.countUsers() === 0) {
  const { salt, hash } = hashPassword("admin");
  repo.createUser({
    id: newId("us"),
    username: "admin",
    displayName: "Administrateur",
    role: "ADMIN",
    passwordHash: hash,
    salt,
    active: true,
    createdAt: nowISO(),
  });
  console.log("");
  console.log("┌──────────────────────────────────────────────────────────────┐");
  console.log("│  Compte administrateur initial créé :                        │");
  console.log("│    identifiant : admin      mot de passe : admin             │");
  console.log("│  ⚠️  Changez ce mot de passe dès la première connexion       │");
  console.log("│     (Profil → Comptes & rôles).                              │");
  console.log("└──────────────────────────────────────────────────────────────┘");
}

const app = createApp(repo);

/** Adresses locales à communiquer aux téléphones (réseau de l'entreprise). */
function lanUrls(port: number): string[] {
  const urls: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const iface of list ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        urls.push(`http://${iface.address}:${port}`);
      }
    }
  }
  return urls;
}

const server = app.listen(PORT, () => {
  console.log("");
  console.log(`TDMI Pointage — serveur démarré (base : ${DB_PATH})`);
  console.log(`  Sur cet ordinateur : http://localhost:${PORT}`);
  const urls = lanUrls(PORT);
  if (urls.length) {
    console.log("  Depuis les téléphones du même réseau (Wi-Fi/4G partagée),");
    console.log("  saisissez cette adresse dans l'écran de connexion :");
    for (const u of urls) console.log(`    → ${u}`);
  }
  console.log("");
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
