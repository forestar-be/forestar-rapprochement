"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Mail,
  Send,
} from "lucide-react";
import {
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Spinner,
} from "@forestar-be/ui";
import {
  previewReminderMail,
  saveReminderEmail,
  sendPaymentReminder,
} from "@/lib/api";
import { formatAmount, formatDay, formatShortDay } from "@/lib/format";
import { settlementLabel, settlementLines } from "@/lib/settlement";
import { PaymentReminders, ReminderGroup, ReminderInvoice } from "@/types";

const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const gmailUrl = (to: string, mail: { subject: string; body: string }) =>
  `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`;

interface ReminderDialogProps {
  reconciliationId: string;
  group: ReminderGroup;
  /** Facture de la ligne d'où la fenêtre est ouverte. */
  openedFrom: ReminderInvoice;
  /** Compte imprimé sur le rappel. */
  account: PaymentReminders["account"];
  /** Délai minimal, en jours, avant un nouveau rappel (fixé par le serveur). */
  resendAfterDays: number;
  onClose: () => void;
  /** Le serveur a envoyé le rappel : la page relit ce qui reste à rappeler. */
  onSent: () => void;
}

/**
 * Rappel de paiement d'un client, ouvert depuis la ligne d'une facture : le
 * rappel reste par client, avec toutes ses factures impayées de ce
 * rapprochement. Le serveur l'envoie après confirmation (si un rappel est déjà
 * parti) ; il refuse de lui-même un second rappel trop proche du premier.
 *
 * Une facture que Dolibarr tient pour soldée n'entre dans le rappel que si le
 * gérant la coche (elle l'est d'office quand la fenêtre s'ouvre depuis sa
 * ligne), et l'envoi demande alors une confirmation.
 */
export default function ReminderDialog({
  reconciliationId,
  group,
  openedFrom,
  account,
  resendAfterDays,
  onClose,
  onSent,
}: ReminderDialogProps) {
  const [now] = useState(() => Date.now());
  const [email, setEmail] = useState(group.email);
  const [savedEmail, setSavedEmail] = useState(group.email);
  const [emailNote, setEmailNote] = useState("");
  const [attachInvoices, setAttachInvoices] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [confirmingResend, setConfirmingResend] = useState(false);
  const [confirmingSettled, setConfirmingSettled] = useState(false);
  // Factures soldées dans Dolibarr que le gérant rappelle quand même.
  const [included, setIncluded] = useState<string[]>(() =>
    openedFrom.settlement ? [openedFrom.ref] : []
  );
  const [preview, setPreview] = useState<{
    key: string;
    mail: { subject: string; body: string } | null;
  } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sent, setSent] = useState<{ sentAt: string; email: string } | null>(
    null
  );

  const forced = useMemo(
    () => group.settledInvoices.filter((i) => included.includes(i.ref)),
    [group.settledInvoices, included]
  );
  const invoices = useMemo(
    () => [...group.invoices, ...forced],
    [group.invoices, forced]
  );
  const totalDue =
    Math.round(invoices.reduce((sum, i) => sum + i.due, 0) * 100) / 100;

  // Le texte préparé par le serveur ne couvre que les factures impayées : dès
  // qu'une facture soldée s'y ajoute, il est redemandé.
  const previewKey = forced.map((i) => i.ref).join(",");
  useEffect(() => {
    if (previewKey === "") return;
    let cancelled = false;
    previewReminderMail(invoices, account)
      .then((mail) => !cancelled && setPreview({ key: previewKey, mail }))
      .catch(() => !cancelled && setPreview({ key: previewKey, mail: null }));
    return () => {
      cancelled = true;
    };
    // `invoices` suit `previewKey`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, account]);
  const mail =
    previewKey === ""
      ? { subject: group.subject, body: group.body }
      : preview?.key === previewKey
        ? preview.mail
        : null;

  // Dernier rappel connu à l'ouverture (le journal du serveur, toutes factures
  // du rappel confondues).
  const previous = useMemo(
    () =>
      invoices
        .map((invoice) => invoice.lastReminder)
        .filter((last) => last !== null)
        .sort((a, b) => (a.sentAt < b.sentAt ? -1 : 1))
        .pop() ?? null,
    [invoices]
  );
  const retryAt = previous
    ? new Date(new Date(previous.sentAt).getTime() + resendAfterDays * DAY_MS)
    : null;
  const tooSoon = retryAt !== null && retryAt.getTime() > now;

  const to = email.trim();
  const emailValid = EMAIL.test(to);
  const plural = invoices.length > 1;
  const forcedRefs = forced.map((i) => i.ref).join(", ");

  // L'adresse saisie est rangée sur la fiche du client dès qu'elle est valide.
  const saveEmail = async () => {
    if (!emailValid || to === savedEmail) return;
    try {
      await saveReminderEmail(group.thirdpartyId, to);
      setSavedEmail(to);
      setEmailNote("Adresse enregistrée sur la fiche du client");
    } catch {
      setEmailNote("L'adresse n'a pas pu être enregistrée dans Dolibarr");
    }
  };

  const send = async () => {
    setSending(true);
    setSendError("");
    try {
      await saveEmail();
      const result = await sendPaymentReminder(
        reconciliationId,
        group.thirdpartyId,
        to,
        attachInvoices,
        forced.map((i) => i.ref)
      );
      setSent({ sentAt: result.sentAt, email: result.email });
      onSent();
    } catch (e) {
      setSendError(
        e instanceof Error && e.message
          ? e.message
          : "Le rappel n'a pas pu être envoyé."
      );
    } finally {
      setSending(false);
    }
  };

  const openInGmail = () => {
    void saveEmail();
    if (mail) window.open(gmailUrl(to, mail), "_blank", "noopener");
  };

  // Une facture soldée dans Dolibarr, ou un second rappel, passe d'abord par
  // une confirmation.
  const handleSendClick = () => {
    setSendError("");
    if (forced.length > 0) setConfirmingSettled(true);
    else if (previous) setConfirmingResend(true);
    else void send();
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && !sending && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg">Rappel de paiement</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{group.name}</span>
              {[group.codeClient, [group.zip, group.town].join(" ").trim()]
                .filter(Boolean)
                .map((part) => ` · ${part}`)}
            </DialogDescription>
          </DialogHeader>

          <div className="min-w-0 space-y-4">
            {previous && !sent && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/35 bg-warning/15 p-3 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>
                  Un rappel a déjà été envoyé le {formatDay(previous.sentAt)} à{" "}
                  {previous.email}.
                  {tooSoon && retryAt && (
                    <>
                      {" "}
                      Nouvel envoi possible à partir du{" "}
                      {formatDay(retryAt.toISOString())}.
                    </>
                  )}
                </span>
              </div>
            )}

            <div className="space-y-2 rounded-lg border p-3">
              <ul className="space-y-1 text-sm">
                {invoices.length === 0 && (
                  <li className="text-muted-foreground">
                    Aucune facture dans ce rappel.
                  </li>
                )}
                {invoices.map((invoice) => (
                  <li
                    key={invoice.ref}
                    className="flex flex-wrap justify-between gap-x-4"
                  >
                    <span>
                      {invoice.ref}
                      <span className="text-muted-foreground">
                        {" "}
                        du {invoice.date}
                      </span>
                    </span>
                    <span>
                      {formatAmount(invoice.due)}
                      {invoice.paid > 0 && (
                        <span className="text-muted-foreground">
                          {" "}
                          (déjà reçu {formatAmount(invoice.paid)})
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                <span>Total à régler</span>
                <span>{formatAmount(totalDue)}</span>
              </div>
            </div>

            {group.settledInvoices.length > 0 && (
              <div className="space-y-2 rounded-lg border border-warning/35 bg-warning/15 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
                  <span>
                    Aucun virement au relevé, mais Dolibarr indique{" "}
                    {group.settledInvoices.length > 1
                      ? "ces factures comme soldées"
                      : "cette facture comme soldée"}
                    . Vérifiez le paiement avant de la rappeler : le rappel
                    réclame alors son montant entier.
                  </span>
                </div>
                <ul className="space-y-2">
                  {group.settledInvoices.map((invoice) => (
                    <li key={invoice.ref} className="flex items-start gap-2">
                      <Checkbox
                        id={`reminder-settled-${invoice.ref}`}
                        className="mt-0.5"
                        checked={included.includes(invoice.ref)}
                        disabled={sending || sent !== null}
                        onCheckedChange={(checked) =>
                          setIncluded((refs) =>
                            checked === true
                              ? [...refs, invoice.ref]
                              : refs.filter((ref) => ref !== invoice.ref)
                          )
                        }
                      />
                      <div className="min-w-0">
                        <Label
                          htmlFor={`reminder-settled-${invoice.ref}`}
                          className="font-normal"
                        >
                          Rappeler quand même {invoice.ref} (
                          {formatAmount(invoice.totalTTC)})
                        </Label>
                        <div className="text-xs text-muted-foreground">
                          {[
                            settlementLabel(invoice.settlement),
                            ...settlementLines(invoice.settlement),
                          ].join(" — ")}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="reminder-email">Adresse e-mail du client</Label>
              <Input
                id="reminder-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailNote("");
                }}
                onBlur={() => void saveEmail()}
                placeholder="client@exemple.be"
                aria-invalid={to !== "" && !emailValid}
              />
              {(emailNote || (to !== "" && !emailValid)) && (
                <p className="text-xs text-muted-foreground">
                  {emailNote || "Adresse incomplète"}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="reminder-attach"
                checked={attachInvoices}
                disabled={sending || sent !== null}
                onCheckedChange={(checked) =>
                  setAttachInvoices(checked === true)
                }
              />
              <Label htmlFor="reminder-attach" className="font-normal">
                {plural ? "Joindre les factures" : "Joindre la facture"}
              </Label>
            </div>

            <div>
              <Button
                variant="ghost"
                size="xs"
                aria-expanded={showDetail}
                onClick={() => setShowDetail((open) => !open)}
              >
                {showDetail ? <ChevronDown /> : <ChevronRight />}
                Détail
              </Button>
              {showDetail && (
                <div className="mt-2 space-y-2">
                  <pre className="max-h-60 overflow-y-auto rounded-md bg-muted p-3 font-sans text-xs whitespace-pre-wrap">
                    {mail
                      ? `${mail.subject}\n\n${mail.body}`
                      : invoices.length === 0
                        ? "Aucune facture dans ce rappel."
                        : preview?.key === previewKey
                          ? "Le texte du rappel n'a pas pu être préparé."
                          : "Préparation du texte…"}
                  </pre>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={!emailValid || !mail || invoices.length === 0}
                    title={
                      emailValid
                        ? "Ouvrir le brouillon dans Gmail"
                        : "Saisissez une adresse e-mail valide"
                    }
                    onClick={openInGmail}
                  >
                    <Mail />
                    Envoyer moi-même
                  </Button>
                </div>
              )}
            </div>

            {sendError && (
              <p role="alert" className="text-sm text-destructive">
                {sendError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={sending} onClick={onClose}>
              Fermer
            </Button>
            {sent ? (
              <Button
                disabled
                variant="outline"
                className="border-success/40 text-success disabled:opacity-100"
              >
                <Check />
                Envoyé le {formatShortDay(sent.sentAt)} à {sent.email}
              </Button>
            ) : (
              <Button
                disabled={
                  !emailValid || sending || tooSoon || invoices.length === 0
                }
                title={
                  tooSoon && retryAt
                    ? `Nouvel envoi possible à partir du ${formatDay(retryAt.toISOString())}`
                    : undefined
                }
                onClick={handleSendClick}
              >
                {sending ? <Spinner /> : <Send />}
                {sending
                  ? "Envoi…"
                  : previous
                    ? "Renvoyer le rappel"
                    : "Envoyer le rappel"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Facture soldée dans Dolibarr : être sûr avant d'écrire au client */}
      <ConfirmDialog
        open={confirmingSettled}
        type="warning"
        title="Rappeler une facture soldée dans Dolibarr"
        message={`Dolibarr indique ${forced.length > 1 ? `les factures ${forcedRefs} comme soldées` : `la facture ${forcedRefs} comme soldée`}. ${previous ? `Un rappel a déjà été envoyé le ${formatDay(previous.sentAt)} à ${previous.email}. ` : ""}Êtes-vous sûr de vouloir envoyer le rappel de ${formatAmount(totalDue)} à ${to} ?`}
        confirmText="Envoyer quand même"
        onClose={() => setConfirmingSettled(false)}
        onConfirm={() => {
          setConfirmingSettled(false);
          void send();
        }}
      />

      {/* Second rappel : rappeler la date et l'adresse du précédent */}
      <ConfirmDialog
        open={confirmingResend}
        type="warning"
        title="Renvoyer le rappel"
        message={
          previous
            ? `Un rappel a déjà été envoyé le ${formatDay(previous.sentAt)} à ${previous.email}. Envoyer un nouveau rappel à ${to} ?`
            : ""
        }
        confirmText="Renvoyer le rappel"
        onClose={() => setConfirmingResend(false)}
        onConfirm={() => {
          setConfirmingResend(false);
          void send();
        }}
      />
    </>
  );
}
