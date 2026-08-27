/* ============================================================
   ATELIER — identite, sauvegarde, apparence
   ------------------------------------------------------------
   La fiche atelier se remplit une seule fois, en trente secondes,
   et ressert a vie sur tous les envois. Elle est ce qui fait
   qu'une cliente qui montre son recapitulatif a ses soeurs leur
   montre aussi le nom et le numero de l'atelier.

   La sauvegarde n'est pas une option technique rangee au fond
   d'un menu : un cahier ne se perd presque jamais, un telephone
   se casse, se vole, se change.
   ============================================================ */

import {
  ecrireAtelier, exporterSauvegarde, importerSauvegarde, lireAtelier, lireTout,
} from '../donnees.js';
import { confirmer, icone, message, txt } from '../interface.js';
import { enregistrer } from '../partage.js';
import { rafraichir } from '../routeur.js';
import { appliquerTheme, themeCourant } from '../theme.js';
import { etatNotifications, demanderNotifications } from '../rappels.js';

const THEMES = [
  { cle: 'auto', libelle: 'Système' },
  { cle: 'light', libelle: 'Clair' },
  { cle: 'dark', libelle: 'Sombre' },
];

export async function vueAtelier() {
  const [atelier, clients, commandes, modeles] = await Promise.all([
    lireAtelier(),
    lireTout('clients'),
    lireTout('commandes'),
    lireTout('modeles'),
  ]);

  const theme = themeCourant();
  const notifications = etatNotifications();

  const section = document.createElement('div');
  section.className = 'pile-large';
  section.innerHTML = `
    <section>
      <h2 class="md-title-medium titre-section">Identité</h2>
      <p class="md-body-medium md-muted espace-apres">Apparaît sur les fiches envoyées aux clientes.</p>
      <div class="md-field">
        <label class="md-label" for="a-nom">Nom de l’atelier</label>
        <input id="a-nom" class="md-input" autocomplete="organization" value="${txt(atelier.nom)}">
      </div>
      <div class="md-field">
        <label class="md-label" for="a-tel">Téléphone</label>
        <input id="a-tel" class="md-input" type="tel" inputmode="tel" autocomplete="tel"
               value="${txt(atelier.telephone)}">
      </div>
      <div class="md-field">
        <label class="md-label" for="a-adresse">Adresse</label>
        <input id="a-adresse" class="md-input" autocomplete="street-address" value="${txt(atelier.adresse)}">
      </div>
      <div class="md-field">
        <label class="md-label" for="a-indicatif">Indicatif du pays</label>
        <div class="champ-suffixe">
          <input id="a-indicatif" class="md-input" inputmode="numeric" value="${txt(atelier.indicatif || '221')}">
        </div>
        <p class="md-help">Complète les numéros notés en local pour ouvrir WhatsApp.</p>
      </div>
      <button class="md-btn md-btn-filled md-btn-block" data-identite>Enregistrer</button>
    </section>

    <section>
      <h2 class="md-title-medium titre-section">Apparence</h2>
      <div class="raccourcis">
        ${THEMES.map((t) => `
          <button class="md-chip md-chip-filter ${theme === t.cle ? 'md-chip-selected' : ''}"
                  data-theme="${t.cle}" aria-pressed="${theme === t.cle}">${txt(t.libelle)}</button>`).join('')}
      </div>
    </section>

    <section>
      <h2 class="md-title-medium titre-section">Rappel du matin</h2>
      ${blocNotifications(notifications)}
    </section>

    <section>
      <h2 class="md-title-medium titre-section">Sauvegarde</h2>
      <p class="md-body-medium md-muted espace-apres">
        Tout est enregistré sur cet appareil, sans compte et sans connexion.
        Un fichier de sauvegarde protège des mesures perdues avec le téléphone.
      </p>
      <dl class="pile-serree espace-apres">
        <div class="ligne-info"><dt>Clientes</dt><dd>${clients.length}</dd></div>
        <div class="ligne-info"><dt>Commandes</dt><dd>${commandes.length}</dd></div>
        <div class="ligne-info"><dt>Modèles</dt><dd>${modeles.length}</dd></div>
      </dl>
      <div class="rangee rangee-souple">
        <button class="md-btn md-btn-tonal" data-exporter>${icone('backup')} Exporter</button>
        <button class="md-btn md-btn-outlined" data-importer>${icone('upload')} Restaurer</button>
      </div>
    </section>

    <p class="md-body-small md-muted">DRESS CODE By Essama</p>`;

  /* ---------- Identite ---------- */
  section.querySelector('[data-identite]').addEventListener('click', async () => {
    await ecrireAtelier({
      ...atelier,
      nom: section.querySelector('#a-nom').value.trim(),
      telephone: section.querySelector('#a-tel').value.trim(),
      adresse: section.querySelector('#a-adresse').value.trim(),
      indicatif: section.querySelector('#a-indicatif').value.replace(/\D/g, ''),
    });
    message('Atelier enregistré');
  });

  /* ---------- Theme ---------- */
  for (const bouton of section.querySelectorAll('[data-theme]')) {
    bouton.addEventListener('click', async () => {
      const choix = bouton.dataset.theme;
      appliquerTheme(choix);
      await ecrireAtelier({ ...atelier, themeChoisi: choix === 'auto' ? null : choix });
      rafraichir();
    });
  }

  /* ---------- Notifications ---------- */
  section.querySelector('[data-notifications]')?.addEventListener('click', async () => {
    const accorde = await demanderNotifications();
    if (!accorde) {
      message('Rappel refusé par le téléphone', { erreur: true });
    }
    rafraichir();
  });

  /* ---------- Sauvegarde ---------- */
  section.querySelector('[data-exporter]').addEventListener('click', async () => {
    const sauvegarde = await exporterSauvegarde();
    const blob = new Blob([JSON.stringify(sauvegarde)], { type: 'application/json' });
    const date = new Date().toISOString().slice(0, 10);
    enregistrer(new File([blob], `dress-code-${date}.json`, { type: 'application/json' }));
    message('Sauvegarde enregistrée');
  });

  section.querySelector('[data-importer]').addEventListener('click', async () => {
    const champ = document.createElement('input');
    champ.type = 'file';
    champ.accept = 'application/json,.json';
    champ.addEventListener('change', async () => {
      const fichier = champ.files?.[0];
      if (!fichier) return;

      /* Une restauration remplace tout : la dire avant, pas apres. */
      const confirme = await confirmer({
        titre: 'Remplacer les données actuelles ?',
        corps: `Les ${clients.length} clientes et ${commandes.length} commandes de cet appareil seront écrasées.`,
        action: 'Restaurer',
        danger: true,
      });
      if (!confirme) return;

      try {
        const contenu = JSON.parse(await fichier.text());
        const bilan = await importerSauvegarde(contenu);
        message(`${bilan.clients} clientes, ${bilan.commandes} commandes restaurées`);
        rafraichir();
      } catch {
        message('Fichier de sauvegarde illisible', { erreur: true });
      }
    }, { once: true });
    champ.click();
  });

  return section;
}

/* Le rappel du matin est le seul endroit ou l'application prend la
   parole d'elle-meme. Une notification par jour, jamais une par
   commande : une application qui vibre huit fois dans la journee
   est desinstallee dans la semaine. */
function blocNotifications(etat) {
  if (etat === 'indisponible') {
    return `<p class="md-alert md-alert-neutral">${icone('notifications')}
      <span>Ce navigateur ne gère pas les rappels. Le résumé reste affiché à l’ouverture.</span></p>`;
  }
  if (etat === 'accorde') {
    return `<p class="md-alert md-alert-tertiary">${icone('notifications_active')}
      <span><span class="md-alert-title">Rappel activé</span>
      Un résumé par jour au maximum, à la première ouverture.</span></p>`;
  }
  if (etat === 'refuse') {
    return `<p class="md-alert md-alert-neutral">${icone('notifications')}
      <span>Rappel bloqué dans les réglages du téléphone. Le résumé reste affiché à l’ouverture.</span></p>`;
  }
  return `
    <p class="md-body-medium md-muted espace-apres">Un résumé par jour au maximum, jamais une alerte par commande.</p>
    <button class="md-btn md-btn-tonal" data-notifications>${icone('notifications')} Activer le rappel</button>`;
}
