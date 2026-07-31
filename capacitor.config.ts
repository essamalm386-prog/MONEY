import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Configuration de l'application mobile TDMI.
 *
 * L'app empaquette la PWA (`web/`) dans une coquille native Android. Elle
 * fonctionne hors-ligne (IndexedDB) et se connecte au serveur de pointage via
 * l'URL configurée dans l'écran Réglages (store.apiBase). `allowMixedContent`
 * autorise un serveur local en http ; en production, préférez un serveur https.
 */
const config: CapacitorConfig = {
  appId: "fr.tdmi.pointage",
  appName: "TDMI Pointage",
  webDir: "web",
  android: {
    allowMixedContent: true,
  },
  backgroundColor: "#0f172aff",
};

export default config;
