/* Genere par outils/sous-ensembler-icones.mjs — ne pas modifier a la main.
   Table nom d'icone Material Symbols -> caractere dans la police
   sous-ensemblee. Ajouter une icone : la lister dans
   outils/icones-utilisees.txt puis relancer le script. */

export const ICONES = {
  today: '\ue8df',
  checkroom: '\uf19e',
  group: '\ue7ef',
  photo_library: '\ue413',
  storefront: '\uea12',
  arrow_back: '\ue5c4',
  close: '\ue14c',
  search: '\ue8b6',
  more_vert: '\ue5d4',
  contrast: '\ueb37',
  menu: '\ue5d2',
  chevron_right: '\ue409',
  expand_more: '\ue5cf',
  arrow_forward: '\ue5c8',
  open_in_new: '\ue895',
  add: '\ue145',
  edit: '\ue150',
  delete: '\ue872',
  check: '\ue5ca',
  check_circle: '\ue86c',
  save: '\ue161',
  content_copy: '\ue14d',
  download: '\ue171',
  share: '\ue80d',
  send: '\ue163',
  call: '\ue0b0',
  person_add: '\ue7fe',
  photo_camera: '\ue3b0',
  add_photo_alternate: '\ue43e',
  image: '\ue251',
  calendar_month: '\uebcc',
  filter_list: '\ue152',
  visibility: '\ue417',
  content_cut: '\ue14e',
  iron: '\ue583',
  inventory_2: '\ue1a1',
  schedule: '\ue192',
  warning: '\ue002',
  priority_high: '\ue645',
  error: '\ue000',
  info: '\ue88e',
  notifications: '\ue7f4',
  notifications_active: '\ue7f7',
  straighten: '\ue41c',
  payments: '\uef63',
  person: '\ue7fd',
  upload: '\ue2c6',
  receipt_long: '\uef6e',
  sell: '\ue54e',
  history: '\ue28e',
  picture_as_pdf: '\ue415',
  celebration: '\uea65',
  cloud_off: '\ue2c1',
  wifi_off: '\ue648',
  backup: '\ue864',
  settings_backup_restore: '\ue8ba',
  sentiment_satisfied: '\ue0ed',
};

/* Rend une icone. Decorative par defaut : le texte a cote dit deja la
   meme chose. Passer { titre } uniquement quand l'icone est seule
   porteuse de sens. */
export function icone(nom, { taille = 24, classe = '', pleine = false, titre = '' } = {}) {
  const glyphe = ICONES[nom];
  if (!glyphe) throw new Error(`Icone absente du sous-ensemble : ${nom}`);
  const classes = ['material-symbols-rounded', `md-icon-${taille}`];
  if (pleine) classes.push('md-icon-filled');
  if (classe) classes.push(classe);
  const acces = titre ? `role="img" aria-label="${titre}"` : 'aria-hidden="true"';
  return `<span class="${classes.join(' ')}" ${acces}>${glyphe}</span>`;
}
