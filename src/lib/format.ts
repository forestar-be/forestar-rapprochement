export const formatAmount = (amount: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);

/** Montant avec son signe, pour un écart : « +0,03 € », « -1,20 € ». */
export const formatSignedAmount = (amount: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    signDisplay: "always",
  }).format(amount);

const BRUSSELS = "Europe/Brussels";

/** « 14/10/2026 », d'après l'heure de Bruxelles. */
export const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-BE", {
    timeZone: BRUSSELS,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

/** « 14/10 », d'après l'heure de Bruxelles. */
export const formatShortDay = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-BE", {
    timeZone: BRUSSELS,
    day: "2-digit",
    month: "2-digit",
  });
