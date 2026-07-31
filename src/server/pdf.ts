/**
 * Génération des relevés mensuels au format PDF (serveur, sans navigateur).
 *
 * Deux documents :
 *  - Relevé INTÉRIM détaillé, groupé par agence (ETT), pour vérifier/comparer
 *    les factures : heures par chantier, jours travaillés, ventilation des
 *    heures supplémentaires par semaine, estimation de coût.
 *  - Relevé SALARIÉS / stagiaires / alternants simplifié : heures par chantier.
 */
import PDFDocument from "pdfkit";
import type {
  Agency,
  BillingStatement,
  Chantier,
  Timesheet,
  WorkerStatement,
  WorkerType,
} from "../core/index.js";
import { chantierLabel } from "../core/index.js";

const TYPE_LABEL: Record<WorkerType, string> = {
  EMPLOYE: "Salarié",
  INTERIMAIRE: "Intérimaire",
  STAGIAIRE: "Stagiaire",
  ALTERNANT: "Alternant",
};

const COMPANY = process.env.COMPANY_NAME ?? "TDMI — Gros Œuvre · Rénovation";

/** Formate un mois "YYYY-MM" en libellé lisible (ex. "juillet 2026"). */
function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const mois = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  return `${mois[(m ?? 1) - 1] ?? month} ${y ?? ""}`.trim();
}

// Formatage maison : virgule décimale + espace ASCII pour les milliers (les
// espaces insécables Unicode de toLocaleString ne sont pas dans WinAnsi/PDF).
function fmtNum(n: number, decimals = 2): string {
  const fixed = (Math.round(n * 100) / 100).toFixed(decimals);
  const [intPart, frac] = fixed.split(".");
  const spaced = intPart!.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return frac ? `${spaced},${frac}` : spaced;
}
const eur = (n: number) => `${fmtNum(n, 2)} €`;
const h = (n: number) => `${fmtNum(n, 2).replace(/,00$/, "").replace(/(,\d)0$/, "$1")} h`;

type Doc = PDFKit.PDFDocument;

/** Collecte le flux PDFKit en un Buffer. */
function toBuffer(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function header(doc: Doc, title: string, subtitle: string): void {
  doc.fillColor("#0f172a").fontSize(16).font("Helvetica-Bold").text(COMPANY);
  doc.moveDown(0.2);
  doc.fillColor("#f97316").fontSize(13).text(title);
  doc.fillColor("#334155").fontSize(10).font("Helvetica").text(subtitle);
  doc.moveDown(0.5);
  const right = doc.page.width - doc.page.margins.right;
  doc.strokeColor("#e2e8f0").moveTo(40, doc.y).lineTo(right, doc.y).stroke();
  doc.moveDown(0.6);
}

/** Dessine une ligne de tableau simple avec colonnes fixes. */
function tableRow(
  doc: Doc,
  cols: Array<{ text: string; x: number; w: number; align?: "left" | "right" }>,
  opts: { bold?: boolean; color?: string; size?: number } = {},
): void {
  const y = doc.y;
  doc
    .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(opts.size ?? 9)
    .fillColor(opts.color ?? "#1e293b");
  for (const c of cols) {
    doc.text(c.text, c.x, y, { width: c.w, align: c.align ?? "left", lineBreak: false });
  }
  doc.y = y + (opts.size ?? 9) + 5;
}

/**
 * Tronque un texte pour qu'il tienne dans la largeur de colonne (avec « … »).
 * `lineBreak: false` empêche le retour à la ligne mais laisse déborder : ici on
 * coupe réellement, ce qui évite les chevauchements entre lignes du tableau.
 */
function clip(doc: Doc, text: string, width: number, size = 9): string {
  doc.fontSize(size);
  if (doc.widthOfString(text) <= width) return text;
  let out = text;
  while (out.length > 1 && doc.widthOfString(out + "…") > width) out = out.slice(0, -1);
  return out.trimEnd() + "…";
}

function ensureSpace(doc: Doc, needed: number): void {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

// Colonnes du relevé (format facture) : Désignation | Quantité | P.U. | Total.
const COLS = {
  label: { x: 40, w: 210 },
  qty: { x: 258, w: 90, align: "right" as const },
  pu: { x: 353, w: 90, align: "right" as const },
  total: { x: 448, w: 107, align: "right" as const },
};

const hc = (n: number) => h(n).replace(" h", ""); // valeur d'heures sans unité

/** Une ligne « désignation / quantité / PU / total » du relevé. */
function elementRow(doc: Doc, label: string, qty: string, pu: number, total: number): void {
  ensureSpace(doc, 15);
  tableRow(doc, [
    { text: label, ...COLS.label },
    { text: qty, ...COLS.qty },
    { text: eur(pu), ...COLS.pu },
    { text: eur(total), ...COLS.total },
  ]);
}

/** Bloc facture pour une semaine d'un chantier (éléments en lignes). */
function weekInvoiceBlock(
  doc: Doc,
  l: import("../core/index.js").BillingLine,
  chantiers: Chantier[],
): void {
  ensureSpace(doc, 150);
  doc
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .fillColor("#1e293b")
    .text(`${chantierLabel(chantiers, l.chantierId)} — Semaine ${l.weekLabel}`, 40, doc.y);
  doc.moveDown(0.25);

  // En-tête de colonnes
  tableRow(
    doc,
    [
      { text: "Désignation", ...COLS.label },
      { text: "Quantité", ...COLS.qty },
      { text: "P.U.", ...COLS.pu },
      { text: "Total", ...COLS.total },
    ],
    { bold: true, color: "#475569" },
  );

  const u = l.unit;
  const a = l.amounts;
  elementRow(doc, "Heures normales", `${hc(l.normalHours)} h`, u.normal, a.normal);
  elementRow(doc, "Heures sup. +25 %", `${hc(l.overtime25Hours)} h`, u.ot25, a.ot25);
  elementRow(doc, "Heures sup. +50 %", `${hc(l.overtime50Hours)} h`, u.ot50, a.ot50);
  elementRow(doc, "Heures fériées", `${hc(l.holidayHours)} h`, u.holiday, a.holiday);
  elementRow(doc, "Intempéries", `${hc(l.weatherHours)} h`, u.weather, a.weather);
  elementRow(doc, "Paniers repas", String(l.mealCount), u.meal, a.meal);
  elementRow(doc, "Indemnités déplacement", String(l.travelCount), u.travel, a.travel);

  // Total général de la semaine
  const y = doc.y + 1;
  doc.strokeColor("#cbd5e1").moveTo(258, y).lineTo(555, y).stroke();
  doc.y = y + 3;
  tableRow(
    doc,
    [
      { text: "TOTAL GÉNÉRAL", ...COLS.label },
      { text: "", ...COLS.qty },
      { text: "", ...COLS.pu },
      { text: eur(l.total), ...COLS.total },
    ],
    { bold: true, color: "#0f172a" },
  );
  doc.moveDown(0.5);
}

/** Bloc « une personne » : ses semaines de facturation, regroupées par chantier. */
function billingWorkerBlock(
  doc: Doc,
  s: BillingStatement,
  chantiers: Chantier[],
  agency: Agency | undefined,
): void {
  ensureSpace(doc, 60);
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#0f172a")
    .text(`${s.worker.lastName.toUpperCase()} ${s.worker.firstName}`, 40, doc.y, { continued: true })
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#64748b")
    .text(
      `   ${s.worker.trade ?? ""}${s.worker.category ? " · " + s.worker.category : ""}${agency ? " · " + agency.name : ""}`,
    );
  doc.moveDown(0.4);

  // Une facture par (chantier × semaine), triée par chantier puis semaine.
  for (const l of s.lines) weekInvoiceBlock(doc, l, chantiers);

  // Total de la personne
  ensureSpace(doc, 24);
  tableRow(
    doc,
    [
      { text: `TOTAL ${s.worker.lastName.toUpperCase()} ${s.worker.firstName} — ${hc(s.totalHours)} h`, x: 40, w: 400 },
      { text: eur(s.total), ...COLS.total },
    ],
    { bold: true, color: "#0f172a", size: 10 },
  );
  const right = doc.page.width - doc.page.margins.right;
  doc.moveDown(0.3);
  doc.strokeColor("#e2e8f0").moveTo(40, doc.y).lineTo(right, doc.y).stroke();
  doc.moveDown(0.6);
}

function billingByAgency(statements: BillingStatement[]): Map<string, BillingStatement[]> {
  const map = new Map<string, BillingStatement[]>();
  for (const s of statements) {
    const key = s.worker.agencyId ?? "SANS_AGENCE";
    (map.get(key) ?? map.set(key, []).get(key)!).push(s);
  }
  return map;
}

export async function interimBillingPdf(
  statements: BillingStatement[],
  chantiers: Chantier[],
  agencies: Agency[],
  month: string,
  filterLabel?: string,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  header(
    doc,
    "Relevé de facturation intérim (ETT)",
    `Période : ${monthLabel(month)}${filterLabel ? " — " + filterLabel : ""} — à comparer aux factures d'agence`,
  );

  const byAgency = billingByAgency(statements);
  if (byAgency.size === 0) {
    doc.font("Helvetica").fontSize(10).fillColor("#64748b").text("Aucun intérimaire sur la période.");
  }

  for (const [agencyId, list] of byAgency) {
    const agency = agencies.find((a) => a.id === agencyId);
    ensureSpace(doc, 50);
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#F39200").text(`Agence : ${agency?.name ?? "Sans agence"}`, 40, doc.y);
    doc.moveDown(0.3);

    let agencyTotal = 0;
    for (const s of list) {
      billingWorkerBlock(doc, s, chantiers, agency);
      agencyTotal += s.total;
    }
    ensureSpace(doc, 24);
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#0f172a")
      .text(`Total agence ${agency?.name ?? ""} : ${eur(Math.round(agencyTotal * 100) / 100)}`, 40, doc.y);
    doc.moveDown(0.8);
  }

  addFooter(doc);
  return toBuffer(doc);
}

export async function salariedMonthlyPdf(
  statements: WorkerStatement[],
  chantiers: Chantier[],
  month: string,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  header(doc, "Relevé mensuel salariés", `Période : ${monthLabel(month)} — heures travaillées par chantier`);

  if (statements.length === 0) {
    doc.font("Helvetica").fontSize(10).fillColor("#64748b").text("Aucune personne sur la période.");
  }

  for (const s of statements) {
    ensureSpace(doc, 90);
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#0f172a")
      .text(`${s.worker.lastName.toUpperCase()} ${s.worker.firstName}`, 40, doc.y, { continued: true })
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#64748b")
      .text(`   ${TYPE_LABEL[s.worker.type as WorkerType]}${s.worker.trade ? " · " + s.worker.trade : ""}${s.worker.category ? " · " + s.worker.category : ""}`);
    doc.moveDown(0.3);
    tableRow(
      doc,
      [
        { text: "Chantier", x: 40, w: 300 },
        { text: "Jours", x: 350, w: 80, align: "right" },
        { text: "Heures", x: 435, w: 110, align: "right" },
      ],
      { bold: true, color: "#475569" },
    );
    for (const line of s.byChantier) {
      tableRow(doc, [
        { text: chantierLabel(chantiers, line.chantierId), x: 40, w: 300 },
        { text: String(line.workedDays), x: 350, w: 80, align: "right" },
        { text: h(Math.round((line.workedMinutes / 60) * 100) / 100), x: 435, w: 110, align: "right" },
      ]);
    }
    tableRow(
      doc,
      [
        { text: `Total`, x: 40, w: 300 },
        { text: `${s.totals.workedDays} j`, x: 350, w: 80, align: "right" },
        { text: h(s.totals.workedHours), x: 435, w: 110, align: "right" },
      ],
      { bold: true, color: "#0f172a" },
    );
    doc.moveDown(0.5);
    doc.strokeColor("#f1f5f9").moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.4);
  }

  addFooter(doc);
  return toBuffer(doc);
}

/** Numérotation des pages en pied de document. */
function addFooter(doc: Doc): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Neutralise la marge basse pour ce rendu : sans cela, écrire sous la marge
    // fait ajouter une page vide à PDFKit.
    const saved = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#94a3b8")
      .text(
        `${COMPANY} — document généré automatiquement · page ${i - range.start + 1}/${range.count}`,
        40,
        doc.page.height - 30,
        { width: 515, align: "center", lineBreak: false },
      );
    doc.page.margins.bottom = saved;
  }
}

/* ===================================================================== */
/*  Relevé d'heures individuel (par personne, sur une période)           */
/* ===================================================================== */

const KIND_TXT: Record<string, string> = {
  TRAVAIL: "Travail",
  ABSENCE: "Absence",
  INTEMPERIE: "Intempérie",
  ACCIDENT: "Accident",
};

// Colonnes du relevé individuel (portrait).
const TS_COLS = {
  date: { x: 40, w: 74 },
  chantier: { x: 116, w: 150 },
  arr: { x: 270, w: 48, align: "right" as const },
  fin: { x: 320, w: 48, align: "right" as const },
  pause: { x: 370, w: 44, align: "right" as const },
  h: { x: 416, w: 52, align: "right" as const },
  nat: { x: 472, w: 83, align: "right" as const },
};

function frDate(iso: string): string {
  const [y = "", m = "", d = ""] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

/**
 * Relevé d'heures individuel : une personne par page, jour par jour avec
 * heure d'arrivée / heure d'arrêt (ou total d'heures saisi directement).
 */
export async function workerTimesheetPdf(
  sheets: Timesheet[],
  chantiers: Chantier[],
  from: string,
  to: string,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  let first = true;

  if (sheets.length === 0) {
    header(doc, "Relevé d'heures individuel", `Période du ${frDate(from)} au ${frDate(to)}`);
    doc.font("Helvetica").fontSize(10).fillColor("#64748b").text("Aucun pointage sur la période.");
  }

  for (const s of sheets) {
    if (!first) doc.addPage();
    first = false;

    header(
      doc,
      "Relevé d'heures individuel",
      `Période du ${frDate(from)} au ${frDate(to)}`,
    );

    // Identité
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor("#0f172a")
      .text(`${s.worker.lastName.toUpperCase()} ${s.worker.firstName}`, 40, doc.y);
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor("#64748b")
      .text(
        [
          TYPE_LABEL[s.worker.type as WorkerType],
          s.worker.trade,
          s.worker.category,
        ]
          .filter(Boolean)
          .join(" · "),
        40,
        doc.y + 2,
      );
    doc.moveDown(0.6);

    // Détail journalier
    tableRow(
      doc,
      [
        { text: "Date", ...TS_COLS.date },
        { text: "Chantier", ...TS_COLS.chantier },
        { text: "Arrivée", ...TS_COLS.arr },
        { text: "Arrêt", ...TS_COLS.fin },
        { text: "Pause", ...TS_COLS.pause },
        { text: "Heures", ...TS_COLS.h },
        { text: "Nature", ...TS_COLS.nat },
      ],
      { bold: true, color: "#475569" },
    );

    for (const d of s.days) {
      ensureSpace(doc, 16);
      const nature =
        d.kind === "ABSENCE"
          ? `Absence${d.absenceReason ? " (" + d.absenceReason.toLowerCase() + ")" : ""}`
          : d.kind === "ACCIDENT"
            ? "Accident"
            : d.kind === "INTEMPERIE"
              ? "Intempérie"
              : d.holiday
                ? "Travail (férié)"
                : KIND_TXT[d.kind] || d.kind;
      tableRow(doc, [
        { text: frDate(d.date), ...TS_COLS.date },
        { text: clip(doc, chantierLabel(chantiers, d.chantierId), TS_COLS.chantier.w), ...TS_COLS.chantier },
        { text: d.startTime || "—", ...TS_COLS.arr },
        { text: d.endTime || "—", ...TS_COLS.fin },
        { text: d.breakMinutes ? `${d.breakMinutes} min` : "—", ...TS_COLS.pause },
        { text: d.minutes ? h(Math.round((d.minutes / 60) * 100) / 100) : "—", ...TS_COLS.h },
        { text: nature, ...TS_COLS.nat },
      ]);
    }

    // Totaux de la période
    doc.moveDown(0.3);
    const right = doc.page.width - doc.page.margins.right;
    doc.strokeColor("#cbd5e1").moveTo(40, doc.y).lineTo(right, doc.y).stroke();
    doc.y += 5;
    tableRow(
      doc,
      [
        { text: `TOTAL PÉRIODE — ${s.totals.workedDays} jour(s) travaillé(s)`, x: 40, w: 370 },
        { text: h(s.totals.workedHours), x: 416, w: 139, align: "right" },
      ],
      { bold: true, color: "#0f172a", size: 10.5 },
    );

    // Ventilation hebdomadaire des heures supplémentaires
    if (s.weeks.length) {
      doc.moveDown(0.5);
      ensureSpace(doc, 60);
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e293b").text("Détail par semaine", 40, doc.y);
      doc.moveDown(0.25);
      tableRow(
        doc,
        [
          { text: "Semaine", x: 40, w: 120 },
          { text: "Heures", x: 200, w: 90, align: "right" },
          { text: "Normales", x: 300, w: 80, align: "right" },
          { text: "Sup. +25 %", x: 385, w: 80, align: "right" },
          { text: "Sup. +50 %", x: 470, w: 85, align: "right" },
        ],
        { bold: true, color: "#475569" },
      );
      for (const w of s.weeks) {
        ensureSpace(doc, 16);
        tableRow(doc, [
          { text: w.weekLabel, x: 40, w: 120 },
          { text: h(w.workedHours), x: 200, w: 90, align: "right" },
          { text: h(w.normalHours), x: 300, w: 80, align: "right" },
          { text: w.overtime25Hours ? h(w.overtime25Hours) : "—", x: 385, w: 80, align: "right" },
          { text: w.overtime50Hours ? h(w.overtime50Hours) : "—", x: 470, w: 85, align: "right" },
        ]);
      }
    }

    // Autres compteurs
    const extras: string[] = [];
    if (s.totals.weatherMinutes) extras.push(`Intempéries : ${h(Math.round((s.totals.weatherMinutes / 60) * 100) / 100)}`);
    if (s.totals.holidayMinutes) extras.push(`Dont fériées : ${h(Math.round((s.totals.holidayMinutes / 60) * 100) / 100)}`);
    if (s.totals.absenceDays) extras.push(`Absences : ${s.totals.absenceDays} jour(s)`);
    if (s.totals.accidentCount) extras.push(`Accidents : ${s.totals.accidentCount}`);
    if (extras.length) {
      doc.moveDown(0.5);
      doc.font("Helvetica").fontSize(9.5).fillColor("#334155").text(extras.join("  ·  "), 40, doc.y);
    }

    // Zone de signature (relevé remis au salarié)
    doc.moveDown(1.6);
    ensureSpace(doc, 70);
    const y = doc.y;
    doc.font("Helvetica").fontSize(9).fillColor("#64748b");
    doc.text("Signature du salarié", 40, y);
    doc.text("Signature du responsable", 320, y);
    doc.strokeColor("#cbd5e1");
    doc.moveTo(40, y + 44).lineTo(250, y + 44).stroke();
    doc.moveTo(320, y + 44).lineTo(530, y + 44).stroke();
    doc.y = y + 52;
  }

  addFooter(doc);
  return toBuffer(doc);
}
