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
  Chantier,
  WorkerStatement,
  WorkerType,
} from "../core/index.js";
import { chantierLabel, statementsByAgency } from "../core/index.js";

const TYPE_LABEL: Record<WorkerType, string> = {
  EMPLOYE: "Salarié",
  INTERIMAIRE: "Intérimaire",
  STAGIAIRE: "Stagiaire",
  ALTERNANT: "Alternant",
};

const COMPANY = process.env.COMPANY_NAME ?? "Mon Entreprise BTP";

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
  doc.strokeColor("#e2e8f0").moveTo(doc.x, doc.y).lineTo(555, doc.y).stroke();
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

/** Bloc « une personne » pour le relevé intérim (détaillé). */
function interimWorkerBlock(doc: Doc, s: WorkerStatement, chantiers: Chantier[]): void {
  ensureSpace(doc, 140);
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#0f172a")
    .text(`${s.worker.lastName.toUpperCase()} ${s.worker.firstName}`, 40, doc.y, { continued: true })
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#64748b")
    .text(`   ${s.worker.trade ?? ""}${s.worker.category ? " · " + s.worker.category : ""}`);
  doc.moveDown(0.3);

  // Heures par chantier
  tableRow(
    doc,
    [
      { text: "Chantier", x: 40, w: 250 },
      { text: "Jours", x: 300, w: 55, align: "right" },
      { text: "Heures", x: 360, w: 60, align: "right" },
      { text: "Intemp.", x: 425, w: 60, align: "right" },
      { text: "Abs.", x: 490, w: 55, align: "right" },
    ],
    { bold: true, color: "#475569" },
  );
  for (const line of s.byChantier) {
    tableRow(doc, [
      { text: chantierLabel(chantiers, line.chantierId), x: 40, w: 250 },
      { text: String(line.workedDays), x: 300, w: 55, align: "right" },
      { text: h(Math.round((line.workedMinutes / 60) * 100) / 100), x: 360, w: 60, align: "right" },
      { text: h(Math.round((line.weatherMinutes / 60) * 100) / 100), x: 425, w: 60, align: "right" },
      { text: String(line.absenceDays), x: 490, w: 55, align: "right" },
    ]);
  }

  // Ventilation heures sup. par semaine
  doc.moveDown(0.2);
  tableRow(
    doc,
    [
      { text: "Semaine", x: 40, w: 120 },
      { text: "H travaillées", x: 200, w: 90, align: "right" },
      { text: "Normal", x: 300, w: 70, align: "right" },
      { text: "+25 %", x: 375, w: 70, align: "right" },
      { text: "+50 %", x: 450, w: 70, align: "right" },
    ],
    { bold: true, color: "#475569" },
  );
  for (const w of s.weeks) {
    tableRow(doc, [
      { text: w.weekKey, x: 40, w: 120 },
      { text: h(w.workedHours), x: 200, w: 90, align: "right" },
      { text: h(w.normalHours), x: 300, w: 70, align: "right" },
      { text: h(w.overtime25Hours), x: 375, w: 70, align: "right" },
      { text: h(w.overtime50Hours), x: 450, w: 70, align: "right" },
    ]);
  }

  // Totaux personne
  doc.moveDown(0.15);
  tableRow(
    doc,
    [
      {
        text: `Total : ${h(s.totals.workedHours)} · ${s.totals.workedDays} j travaillés · sup. +25% ${h(s.totals.overtime25Hours)} / +50% ${h(s.totals.overtime50Hours)}`,
        x: 40,
        w: 340,
      },
      { text: `Coût estimé : ${eur(s.cost.total)}`, x: 380, w: 165, align: "right" },
    ],
    { bold: true, color: "#0f172a" },
  );
  doc.moveDown(0.5);
  doc.strokeColor("#f1f5f9").moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.4);
}

export async function interimMonthlyPdf(
  statements: WorkerStatement[],
  chantiers: Chantier[],
  agencies: Agency[],
  month: string,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  header(doc, "Relevé mensuel intérim (ETT)", `Période : ${monthLabel(month)} — à comparer aux factures d'agence`);

  const byAgency = statementsByAgency(statements);
  if (byAgency.size === 0) {
    doc.font("Helvetica").fontSize(10).fillColor("#64748b").text("Aucun intérimaire sur la période.");
  }

  for (const [agencyId, list] of byAgency) {
    const agency = agencies.find((a) => a.id === agencyId);
    ensureSpace(doc, 60);
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#f97316")
      .text(`Agence : ${agency?.name ?? agencyId}`);
    doc.moveDown(0.3);

    let totHours = 0;
    let totDays = 0;
    let totCost = 0;
    for (const s of list) {
      interimWorkerBlock(doc, s, chantiers);
      totHours += s.totals.workedHours;
      totDays += s.totals.workedDays;
      totCost += s.cost.total;
    }
    ensureSpace(doc, 30);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#0f172a")
      .text(
        `Sous-total ${agency?.name ?? agencyId} : ${h(Math.round(totHours * 100) / 100)} · ${totDays} jours · ${eur(totCost)}`,
      );
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
