"use client";

import React, { useMemo, useState } from "react";
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
import { saveReminderEmail, sendPaymentReminder } from "@/lib/api";
import { formatAmount, formatDay, formatShortDay } from "@/lib/format";
import { ReminderGroup } from "@/types";

const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const gmailUrl = (to: string, group: ReminderGroup) =>
  `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(group.subject)}&body=${encodeURIComponent(group.body)}`;

interface ReminderDialogProps {
  reconciliationId: string;
  group: ReminderGroup;
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
 */
export default function ReminderDialog({
  reconciliationId,
  group,
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
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sent, setSent] = useState<{ sentAt: string; email: string } | null>(
    null
  );

  // Dernier rappel connu à l'ouverture (le journal du serveur, toutes factures
  // du client confondues).
  const previous = useMemo(
    () =>
      group.invoices
        .map((invoice) => invoice.lastReminder)
        .filter((last) => last !== null)
        .sort((a, b) => (a.sentAt < b.sentAt ? -1 : 1))
        .pop() ?? null,
    [group.invoices]
  );
  const retryAt = previous
    ? new Date(new Date(previous.sentAt).getTime() + resendAfterDays * DAY_MS)
    : null;
  const tooSoon = retryAt !== null && retryAt.getTime() > now;

  const to = email.trim();
  const emailValid = EMAIL.test(to);
  const plural = group.invoices.length > 1;

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
        attachInvoices
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
    window.open(gmailUrl(to, group), "_blank", "noopener");
  };

  // Un second rappel passe d'abord par une confirmation.
  const handleSendClick = () => {
    setSendError("");
    if (previous) setConfirmingResend(true);
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
                {group.invoices.map((invoice) => (
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
                <span>{formatAmount(group.totalDue)}</span>
              </div>
            </div>

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
                    {`${group.subject}\n\n${group.body}`}
                  </pre>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={!emailValid}
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
                disabled={!emailValid || sending || tooSoon}
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
