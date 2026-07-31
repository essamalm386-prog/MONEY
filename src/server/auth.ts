/**
 * Authentification & rôles.
 *
 * - Mots de passe hachés en scrypt (sel par utilisateur, comparaison à temps
 *   constant) — jamais stockés en clair.
 * - Sessions par jeton opaque (aléatoire, 30 jours) transmis en
 *   `Authorization: Bearer <token>`.
 * - Trois rôles hiérarchiques :
 *     CHEF        : pointe son équipe, consulte le planning et les rapports
 *                   (sans les coûts) ;
 *     CONDUCTEUR  : + gère les affectations et le référentiel
 *                   (personnel, chantiers, agences) ;
 *     ADMIN       : + coûts, relevés PDF, comptes utilisateurs.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Repository } from "./repository.js";

export type Role = "CHEF" | "CONDUCTEUR" | "ADMIN";

export const ROLE_RANK: Record<Role, number> = { CHEF: 1, CONDUCTEUR: 2, ADMIN: 3 };

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  active: boolean;
  createdAt: string;
  /** Salarié correspondant : un chef est membre du personnel qu'il encadre. */
  workerId?: string;
}

export interface SessionUser extends User {
  token: string;
}

/** Hache un mot de passe (scrypt). Renvoie sel et empreinte en hex. */
export function hashPassword(password: string, saltHex?: string): { salt: string; hash: string } {
  const salt = saltHex ?? randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

/** Vérifie un mot de passe à temps constant. */
export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(expectedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Jeton de session opaque. */
export function newToken(): string {
  return randomBytes(24).toString("hex");
}

export const SESSION_DAYS = 30;

declare module "express-serve-static-core" {
  interface Request {
    user?: SessionUser;
  }
}

/** Middleware : exige une session valide, attache `req.user`. */
export function requireAuth(repo: Repository) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    const user = token ? repo.getSessionUser(token) : undefined;
    if (!user) return res.status(401).json({ error: "non authentifié" });
    if (!user.active) return res.status(403).json({ error: "compte désactivé" });
    req.user = user;
    next();
  };
}

/** Middleware : exige un rôle minimal (hiérarchique). */
export function requireRole(min: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role || ROLE_RANK[role] < ROLE_RANK[min]) {
      return res.status(403).json({ error: "accès refusé (rôle insuffisant)" });
    }
    next();
  };
}
