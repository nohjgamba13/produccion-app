export type Role =
  | "admin"
  | "supervisor"
  | "operator"
  | "operador"
  | null;

export type NormalizedRole =
  | "admin"
  | "supervisor"
  | "operator"
  | null;

/**
 * Normaliza roles inconsistentes
 */
export function normalizeRole(
  role: string | null | undefined
): NormalizedRole {
  if (!role) return null;

  const r = role.toLowerCase().trim();

  if (r === "admin") return "admin";

  if (r === "supervisor") return "supervisor";

  // Compatibilidad total
  if (r === "operator" || r === "operador") {
    return "operator";
  }

  return null;
}

/**
 * Admin y supervisor ven todo
 */
export function canSeeAll(
  role: string | null | undefined
): boolean {
  const r = normalizeRole(role);

  return r === "admin" || r === "supervisor";
}

/**
 * Operarios
 */
export function isOperator(
  role: string | null | undefined
): boolean {
  return normalizeRole(role) === "operator";
}

/**
 * Crear órdenes
 */
export function canCreateOrders(
  role: string | null | undefined
): boolean {
  const r = normalizeRole(role);

  return r === "admin" || r === "supervisor";
}

/**
 * Solo admins
 */
export function isAdmin(
  role: string | null | undefined
): boolean {
  return normalizeRole(role) === "admin";
}