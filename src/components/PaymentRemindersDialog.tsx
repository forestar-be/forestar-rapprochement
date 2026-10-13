"use client";

import React, { useState } from "react";
import { Check, Copy, Download, Mail, Send } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
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
  downloadInvoicePdf,
  getPaymentReminders,
  saveReminderEmail,
  sendPaymentReminder,
} from "@/lib/api";
import { formatAmount } from "@/lib/format";
import { PaymentReminders, ReminderGroup } from "@/types";

const PREPARED_KEY = "rappels_prepares";
const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

type Prepared = Record<string, string>; // référence de facture → date AAAA-MM-JJ

const readPrepared = (): Prepared => {
  try {
    return JSON.parse(localStorage.getItem(PREPARED_KEY) || "{}");
  } catch {
    return {};
  }
};

const plural = (n: number, one: string, many: string) =>
  `${n} ${n > 1 ? many : one}`;

const gmailUrl = (to: string, group: ReminderGroup) =>
  `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(group.subject)}&body=${encodeURIComponent(group.body)}`;

const mailtoUrl = (to: string, group: ReminderGroup) =>
  `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(group.subject)}&body=${encodeURIComponent(group.body)}`;

const shortDay = (iso: string) =>
  iso.slice(0, 10).split("-").reverse().slice(0, 2).join("/");

function ReminderRow({
  reconciliationId,
  group,
  preparedOn,
  onPrepared,
}: {
  reconciliationId: string;
  group: ReminderGroup;
  preparedOn?: string;
  onPrepared: (group: ReminderGroup) => void;
}) {
  const [email, setEmail] = useState(group.email);
  const [savedEmail, setSavedEmail] = useState(group.email);
  const [emailNote, setEmailNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [attachInvoices, setAttachInvoices] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  // Dernier envoi par le serveur : celui de cette session, sinon le journal.
  const [sentOn, setSentOn] = useState(
    group.invoices
      .map((i) => i.lastReminderAt ?? "")
      .filter(Boolean)
      .sort()
      .pop() ?? ""
  );

  const to = email.trim();
  const emailValid = EMAIL.test(to);

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
      setSentOn(result.sentAt);
    } catch (e) {
      setSendError(
        e instanceof Error && e.message
          ? e.message
          : "Le rappel n'a pas pu être envoyé."
      );
    } finally {
      setSending(false);
      setConfirming(false);
    }
  };

  const open = (url: string) => {
    void saveEmail();
    window.open(url, "_blank", "noopener");
    onPrepared(group);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${group.subject}\n\n${group.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onPrepared(group);
    } catch {
      setCopied(false);
    }
  };

  const downloadInvoices = async () => {
    setDownloading(true);
    setDownloadError("");
    try {
      for (const invoice of group.invoices) {
        const blob = await downloadInvoicePdf(invoice.ref);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${invoice.ref}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
    } catch {
      setDownloadError("Une facture n'a pas pu être téléchargée.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <li className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium">{group.name}</div>
          <div className="text-xs text-muted-foreground">
            {[group.codeClient, [group.zip, group.town].join(" ").trim()]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold">{formatAmount(group.totalDue)}</div>
          {sentOn ? (
            <div className="text-xs text-success">
              Rappel envoyé le {shortDay(sentOn)}
            </div>
          ) : (
            preparedOn && (
              <div className="text-xs text-muted-foreground">
                Rappel préparé le {shortDay(preparedOn)}
              </div>
            )
          )}
        </div>
      </div>

      <ul className="space-y-1 text-sm">
        {group.invoices.map((invoice) => (
          <li
            key={invoice.ref}
            className="flex flex-wrap justify-between gap-x-4"
          >
            <span>
              {invoice.ref}
              <span className="text-muted-foreground"> du {invoice.date}</span>
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

      <div>
        <Input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailNote("");
          }}
          onBlur={() => void saveEmail()}
          placeholder="Adresse e-mail du client"
          aria-label={`Adresse e-mail de ${group.name}`}
          aria-invalid={to !== "" && !emailValid}
        />
        {(emailNote || (to !== "" && !emailValid)) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {emailNote || "Adresse incomplète"}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {confirming ? (
          <>
            <Button size="sm" disabled={sending} onClick={() => void send()}>
              {sending ? <Spinner /> : <Send />}
              Confirmer l&apos;envoi à {to}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={sending}
              onClick={() => setConfirming(false)}
            >
              Annuler
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            disabled={!emailValid}
            onClick={() => {
              setSendError("");
              setConfirming(true);
            }}
          >
            <Send />
            {sentOn ? "Renvoyer le rappel" : "Envoyer le rappel"}
          </Button>
        )}
        <div className="flex items-center gap-2">
          <Checkbox
            id={`joindre-${group.thirdpartyId}`}
            checked={attachInvoices}
            disabled={sending}
            onCheckedChange={(checked) => setAttachInvoices(checked === true)}
          />
          <Label
            htmlFor={`joindre-${group.thirdpartyId}`}
            className="text-sm font-normal"
          >
            {group.invoices.length > 1
              ? "Joindre les factures"
              : "Joindre la facture"}
          </Label>
        </div>
      </div>
      {sendError && <p className="text-xs text-destructive">{sendError}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          Ou l&apos;envoyer moi-même :
        </span>
        <Button
          size="xs"
          variant="outline"
          onClick={() => open(gmailUrl(to, group))}
        >
          <Mail />
          Gmail
        </Button>
        <Button
          size="xs"
          variant="outline"
          onClick={() => open(mailtoUrl(to, group))}
        >
          Autre messagerie
        </Button>
        <Button size="xs" variant="outline" onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copié" : "Copier le texte"}
        </Button>
        <Button
          size="xs"
          variant="outline"
          disabled={downloading}
          onClick={() => void downloadInvoices()}
        >
          {downloading ? <Spinner /> : <Download />}
          {group.invoices.length > 1
            ? `${group.invoices.length} factures PDF`
            : "Facture PDF"}
        </Button>
      </div>
      {downloadError && (
        <p className="text-xs text-destructive">{downloadError}</p>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          Lire le message
        </summary>
        <pre className="mt-2 rounded-md bg-muted p-3 font-sans text-xs whitespace-pre-wrap">
          {`${group.subject}\n\n${group.body}`}
        </pre>
      </details>
    </li>
  );
}

/**
 * Rappels de paiement d'un rapprochement : un rappel par client resté impayé,
 * envoyé par le serveur (avec ou sans les factures jointes) après
 * confirmation, ou ouvert en brouillon dans la messagerie du gérant.
 */
export default function PaymentRemindersDialog({
  reconciliationId,
}: {
  reconciliationId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reminders, setReminders] = useState<PaymentReminders | null>(null);
  const [prepared, setPrepared] = useState<Prepared>({});

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setReminders(await getPaymentReminders(reconciliationId));
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : "Les rappels n'ont pas pu être préparés."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setPrepared(readPrepared());
      void load();
    }
  };

  const markPrepared = (group: ReminderGroup) => {
    const today = new Date().toISOString().slice(0, 10);
    const next = { ...readPrepared() };
    for (const invoice of group.invoices) next[invoice.ref] = today;
    setPrepared(next);
    try {
      localStorage.setItem(PREPARED_KEY, JSON.stringify(next));
    } catch {
      // stockage indisponible : la mention ne survit pas au rechargement
    }
  };

  const groups = reminders?.groups ?? [];
  const total = groups.reduce((sum, g) => sum + g.totalDue, 0);

  return (
    <>
      <Button variant="outline" onClick={() => handleOpenChange(true)}>
        <Mail />
        Rappels de paiement
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">Rappels de paiement</DialogTitle>
            <DialogDescription>
              Factures sans virement au relevé et encore impayées dans Dolibarr.
              Le rappel part de l&apos;adresse de Forestar, avec ou sans la
              facture jointe ; vous pouvez aussi l&apos;envoyer vous-même depuis
              votre messagerie.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {loading && (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Spinner />
                Lecture de Dolibarr…
              </div>
            )}

            {!loading && error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!loading && !error && reminders && (
              <>
                <p className="text-sm">
                  {groups.length > 0 ? (
                    <>
                      <strong>
                        {plural(groups.length, "client", "clients")}
                      </strong>{" "}
                      à rappeler pour <strong>{formatAmount(total)}</strong>.
                    </>
                  ) : (
                    "Aucune facture à rappeler."
                  )}
                </p>

                {(reminders.toVerify > 0 ||
                  reminders.settledInDolibarr.length > 0 ||
                  reminders.unknownInDolibarr.length > 0) && (
                  <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                    {reminders.toVerify > 0 && (
                      <li>
                        {plural(
                          reminders.toVerify,
                          "facture a une association à vérifier : elle reste",
                          "factures ont une association à vérifier : elles restent"
                        )}{" "}
                        hors rappel tant qu&apos;elle n&apos;est pas tranchée.
                      </li>
                    )}
                    {reminders.settledInDolibarr.length > 0 && (
                      <li>
                        {plural(
                          reminders.settledInDolibarr.length,
                          "facture sans virement au relevé est déjà soldée",
                          "factures sans virement au relevé sont déjà soldées"
                        )}{" "}
                        dans Dolibarr : pas de rappel.
                      </li>
                    )}
                    {reminders.unknownInDolibarr.length > 0 && (
                      <li>
                        Introuvable dans Dolibarr :{" "}
                        {reminders.unknownInDolibarr.join(", ")}.
                      </li>
                    )}
                  </ul>
                )}

                <ul className="space-y-3">
                  {groups.map((group) => (
                    <ReminderRow
                      key={group.thirdpartyId}
                      reconciliationId={reconciliationId}
                      group={group}
                      preparedOn={
                        group.invoices
                          .map((i) => prepared[i.ref])
                          .filter(Boolean)
                          .sort()
                          .pop() || undefined
                      }
                      onPrepared={markPrepared}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
