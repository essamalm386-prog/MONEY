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

function ensureSpace(doc: Doc, needed: number): void {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

// Colonnes du tableau de facturation (paysage).
const COLS = {
  week: { x: 40, w: 60 },
  norm: { x: 105, w: 62, align: "right" as const },
  ot25: { x: 172, w: 58, align: "right" as const },
  ot50: { x: 235, w: 58, align: "right" as const },
  ferie: { x: 298, w: 58, align: "right" as const },
  intemp: { x: 361, w: 62, align: "right" as const },
  panier: { x: 428, w: 62, align: "right" as const },
  depl: { x: 495, w: 62, align: "right" as const },
  total: { x: 562, w: 200, align: "right" as const },
};

const hc = (n: number) => h(n).replace(" h", ""); // valeur d'heures sans unité

/** Bloc « une personne » (relevé de facturation intérim, détaillé par semaine). */
function billingWorkerBlock(
  doc: Doc,
  s: BillingStatement,
  chantiers: Chantier[],
  agency: Agency | undefined,
): void {
  ensureSpace(doc, 120);
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
  doc.moveDown(0.3);

  // Regroupe les lignes par chantier.
  const byChantier = new Map<string, typeof s.lines>();
  for (const l of s.lines) (byChantier.get(l.chantierId) ?? byChantier.set(l.chantierId, []).get(l.chantierId)!).push(l);

  for (const [chantierId, lines] of byChantier) {
    ensureSpace(doc, 70);
    const pu = lines[0]!.unit;
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#1e293b").text(chantierLabel(chantiers, chantierId), 40, doc.y);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#64748b")
      .text(
        `PU — Normale ${eur(pu.normal)} · +25% ${eur(pu.ot25)} · +50% ${eur(pu.ot50)} · Fériée ${eur(pu.holiday)} · Intemp. ${eur(pu.weather)} · Panier ${eur(pu.meal)} · Dépl. ${eur(pu.travel)}`,
        40,
        doc.y + 2,
      );
    doc.moveDown(0.3);

    // En-tête du tableau
    tableRow(
      doc,
      [
        { text: "Semaine", ...COLS.week },
        { text: "H norm.", ...COLS.norm },
        { text: "H +25%", ...COLS.ot25 },
        { text: "H +50%", ...COLS.ot50 },
        { text: "Fériées", ...COLS.ferie },
        { text: "Intemp.", ...COLS.intemp },
        { text: "Paniers", ...COLS.panier },
        { text: "Dépl.", ...COLS.depl },
        { text: "Total", ...COLS.total },
      ],
      { bold: true, color: "#475569" },
    );

    let cTotal = 0;
    for (const l of lines) {
      ensureSpace(doc, 16);
      tableRow(doc, [
        { text: l.weekLabel, ...COLS.week },
        { text: hc(l.normalHours), ...COLS.norm },
        { text: hc(l.overtime25Hours), ...COLS.ot25 },
        { text: hc(l.overtime50Hours), ...COLS.ot50 },
        { text: hc(l.holidayHours), ...COLS.ferie },
        { text: hc(l.weatherHours), ...COLS.intemp },
        { text: String(l.mealCount), ...COLS.panier },
        { text: String(l.travelCount), ...COLS.depl },
        { text: eur(l.total), ...COLS.total },
      ]);
      cTotal += l.total;
    }
    // Sous-total chantier
    tableRow(
      doc,
      [
        { text: `Sous-total ${chantierLabel(chantiers, chantierId)}`, x: 40, w: 500 },
        { text: eur(Math.round(cTotal * 100) / 100), ...COLS.total },
      ],
      { bold: true, color: "#0f172a" },
    );
    doc.moveDown(0.3);
  }

  // Total personne
  doc.moveDown(0.1);
  tableRow(
    doc,
    [
      { text: `TOTAL ${s.worker.lastName.toUpperCase()} ${s.worker.firstName} — ${hc(s.totalHours)} h`, x: 40, w: 500 },
      { text: eur(s.total), ...COLS.total },
    ],
    { bold: true, color: "#0f172a", size: 10 },
  );
  const right = doc.page.width - doc.page.margins.right;
  doc.moveDown(0.3);
  doc.strokeColor("#e2e8f0").moveTo(40, doc.y).lineTo(right, doc.y).stroke();
  doc.moveDown(0.5);
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
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40, bufferPages: true });
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
