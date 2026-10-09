"use client";

import { useNavigate } from "@tanstack/react-router";
import {
  createContext,
  useContext,
  useId,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { NativeSelect } from "@/components/native-select";
import {
  ReservationBookingPage,
  ReservationManagePage,
  ReservationsCalendar,
  ReservationSettingsPage,
  type ReservationLabels,
} from "@/components/plugins/reservations";
import { createReservationsMock } from "@/showroom/reservations-mock";
import { ShowroomLink as Link, useShowroomParams } from "@/showroom/routing";
import { previewDataNotice, ShowroomPreview } from "@/showroom/showroom-preview";

const french: ReservationLabels = {
  accommodation: "Hébergement",
  stayService: "Offre de séjour",
  stayBooking: "Réserver un séjour",
  stayBook: "Réserver le séjour",
  stayAnother: "Réserver un autre séjour",
  arrivalDate: "Date d’arrivée",
  departureDate: "Date de départ",
  arrivalStart: "Première arrivée",
  arrivalEnd: "Fin des arrivées (exclue)",
  checkoutTime: "Heure de départ",
  minNights: "Nuits minimum",
  maxNights: "Nuits maximum",
  nights: "Nuits",
  blockedDates: "Dates bloquées",
  blockedFrom: "Bloqué du",
  blockedThrough: "Bloqué jusqu’au (inclus)",
  addClosure: "Ajouter une fermeture",
  closuresHelp:
    "Les hébergements actifs sont disponibles en continu, sauf réservations et dates bloquées. Les deux dates de fermeture sont incluses.",
  stayYearHelp:
    "Sélectionnez une date pour ouvrir ses réservations. Les comptes incluent chaque jour occupé, y compris le jour du départ.",
  modeMismatch:
    "Le mode de réservation du site ne correspond pas à cette installation. Contactez l’administrateur.",
  booking: "Réserver un rendez-vous",
  manage: "Gérer la réservation",
  calendar: "Réservations",
  settings: "Paramètres des réservations",
  service: "Prestation",
  resource: "Praticien ou ressource",
  anyResource: "Sans préférence",
  date: "Date",
  time: "Heure",
  previous: "Précédent",
  next: "Suivant",
  today: "Aujourd'hui",
  year: "Année",
  yearHelp:
    "Sélectionnez une date pour voir ses rendez-vous. Les pastilles indiquent le nombre de réservations. Les week-ends sont grisés.",
  month: "Mois",
  week: "Semaine",
  day: "Jour",
  agenda: "Liste",
  name: "Nom",
  email: "E-mail",
  phone: "Téléphone (facultatif)",
  review: "Vérifier la réservation",
  back: "Retour",
  book: "Réserver",
  booked:
    "Votre réservation est enregistrée. Consultez votre e-mail pour obtenir le lien privé de gestion.",
  another: "Réserver un autre rendez-vous",
  duration: "Durée (minutes)",
  timeZone: "Fuseau horaire de l'établissement",
  cancellationDeadline: "Annuler ou déplacer avant le",
  approvalRequired:
    "Cette réservation nécessite une validation. Le créneau est réservé en attendant.",
  automaticApproval: "Cette réservation est confirmé automatiquement.",
  moveWarning: "Déplacer cette réservation libère l'ancien créneau. Le nouveau devra être validé.",
  pending: "En attente de validation",
  confirmed: "Confirmé",
  rejected: "Refusé",
  cancelled: "Annulé",
  cancel: "Annuler la réservation",
  cancelConfirm: "Annuler cette réservation et libérer son créneau ?",
  keep: "Conserver la réservation",
  reschedule: "Déplacer",
  saveMove: "Enregistrer le nouveau créneau",
  cutoff: "Le délai de modification est dépassé. Contactez l'établissement.",
  approve: "Valider",
  reject: "Refuser",
  rejectConfirm: "Refuser cette demande et libérer son créneau ?",
  close: "Fermer",
  loading: "Chargement…",
  emptySlots: "Aucun créneau disponible à cette date.",
  emptyServices: "Aucune prestation disponible.",
  emptyCalendar: "Aucune réservation sur cette période.",
  unavailable: "Les réservations en ligne sont actuellement fermées.",
  error: "Une erreur est survenue. Réessayez.",
  invalid: "Vérifiez les valeurs saisies.",
  conflict:
    "Cette réservation ou ce créneau a changé. Actualisez puis choisissez un créneau disponible.",
  forbidden: "Vous n'avez pas l'autorisation d'effectuer cette action.",
  invalidLink:
    "Ce lien privé est invalide ou a expiré. Contactez l'établissement pour en recevoir un nouveau.",
  refresh: "Actualiser",
  save: "Enregistrer",
  saved: "Enregistré.",
  saving: "Enregistrement…",
  all: "Tous",
  status: "Statut",
  newBooking: "Nouvelle réservation",
  outsideHours: "En dehors des horaires actuels",
  emailFailed: "Échec de l'envoi de l'e-mail",
  retryEmail: "Renvoyer l'e-mail",
  revokeLink: "Remplacer le lien privé",
  revokeConfirm: "Invalider les anciens liens et envoyer un nouveau lien par e-mail ?",
  retryQueued: "E-mail mis en attente d'envoi.",
  business: "Établissement",
  services: "Prestations",
  resources: "Ressources",
  newService: "Nouvelle prestation",
  newResource: "Nouvelle ressource",
  edit: "Modifier",
  description: "Description",
  active: "Actif",
  archived: "Archivé",
  archive: "Archiver",
  archiveConfirm: "Archiver cet élément ? Les réservations existantes restent disponibles.",
  publicEnabled: "Autoriser les réservations en ligne",
  bufferBefore: "Temps de préparation (minutes)",
  bufferAfter: "Temps de nettoyage (minutes)",
  cancellation: "Délai d'annulation (minutes)",
  approval: "Validation",
  automatic: "Automatique",
  manual: "Manuelle",
  notice: "Délai minimum de réservation (minutes)",
  horizon: "Réservation à l'avance (jours)",
  interval: "Intervalle entre les débuts (minutes)",
  eligibleResources: "Ressources disponibles",
  hours: "Horaires hebdomadaires",
  exceptions: "Horaires particuliers et fermetures",
  addHours: "Ajouter une plage",
  remove: "Supprimer",
  addException: "Ajouter une date",
  closed: "Fermé",
  start: "Début",
  end: "Fin",
  hoursHelp:
    "Séparez les plages pour les pauses. Une exception remplace tous les horaires de cette date. Laissez-la vide pour fermer la journée.",
  policyHelp:
    "Les changements s'appliquent aux nouvelles réservations. Les réservations existantes conservent leurs règles.",
  weekday1: "Lundi",
  weekday2: "Mardi",
  weekday3: "Mercredi",
  weekday4: "Jeudi",
  weekday5: "Vendredi",
  weekday6: "Samedi",
  weekday7: "Dimanche",
};

const Context = createContext<ReturnType<typeof createReservationsMock> | null>(null);
function useMock() {
  const mock = useContext(Context);
  if (!mock) throw new Error("Missing reservations preview provider");
  useSyncExternalStore(mock.subscribe, mock.snapshot, () => 0);
  return mock;
}

export function ReservationsPreviewProvider({ children }: { children: ReactNode }) {
  const selectId = `factory-showroom-reservations-${useId()}`;
  const [mock] = useState(createReservationsMock);
  const { locale } = useShowroomParams();
  useSyncExternalStore(mock.subscribe, mock.snapshot, () => 0);
  const last = mock.reservations.at(-1);
  return (
    <Context.Provider value={mock}>
      <ShowroomPreview
        notice={previewDataNotice}
        navigation={
          <>
            <Link href={`/${locale}/reservations`}>Public booking</Link>
            <Link href={`/${locale}/admin/reservations`}>Staff calendar</Link>
            <Link href={`/${locale}/admin/reservations/settings`}>Settings</Link>
            <Link href={locale === "fr" ? "/en/reservations" : "/fr/reservations"}>
              {locale === "fr" ? "English" : "Français"}
            </Link>
          </>
        }
        controls={
          <div className="space-y-4">
            <label htmlFor={`${selectId}-example`} className="grid gap-2">
              Example
              <NativeSelect
                id={`${selectId}-example`}
                className="rounded-md border border-input bg-background p-2"
                value={mock.scenario}
                onChange={(e) =>
                  mock.reset(e.target.value as "hairdresser" | "clinic" | "apartment")
                }
              >
                <option value="hairdresser">Hairdresser</option>
                <option value="apartment">Apartment · overnight stays</option>
                <option value="clinic">Clinic · manual approval</option>
              </NativeSelect>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mock.fail}
                onChange={(e) => mock.setFail(e.target.checked)}
              />
              Simulate action failures
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mock.slow}
                onChange={(e) => mock.setSlow(e.target.checked)}
              />
              Slow responses
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-md border border-border px-3 py-2"
                onClick={() => mock.reset(mock.scenario, true)}
              >
                Empty calendar
              </button>
              <button
                className="rounded-md border border-border px-3 py-2"
                onClick={() => mock.reset()}
              >
                Reset demo
              </button>
            </div>
            <div className="space-y-2 border-t border-border pt-4">
              <h2 className="font-medium">Demo inbox</h2>
              <p className="text-xs text-muted-foreground">
                Reservation emails appear here only. No email is sent.
              </p>
              {last && (
                <Link href={`/${locale}/reservations/manage/${last.id}`}>
                  Manage latest reservation
                </Link>
              )}
            </div>
          </div>
        }
      >
        {children}
      </ShowroomPreview>
    </Context.Provider>
  );
}

export function ReservationPublicPreview() {
  const mock = useMock();
  const { locale, segments } = useShowroomParams();
  const labels = locale === "fr" ? french : undefined;
  return segments[0] === "manage" && segments[1] ? (
    <ReservationManagePage
      key={segments[1]}
      client={mock.managementClient(segments[1])}
      locale={locale}
      labels={labels}
      className="showroom-page"
    />
  ) : (
    <ReservationBookingPage
      key={`${mock.generation}-${locale}`}
      client={mock.publicClient}
      locale={locale}
      labels={labels}
      initialDate={mock.initialDate}
      className="showroom-page"
    />
  );
}

export function ReservationAdminPreview() {
  const mock = useMock();
  const { locale, segments } = useShowroomParams();
  const navigate = useNavigate();
  const labels = locale === "fr" ? french : undefined;
  const base = `/${locale}/admin/reservations`;
  if (segments[0] === "settings")
    return (
      <ReservationSettingsPage
        key={`${mock.generation}-${segments.join("/")}`}
        client={mock.adminClient}
        labels={labels}
        className="showroom-page"
        linkComponent={Link}
        editor={
          segments[1] === "services" || segments[1] === "resources"
            ? {
                kind: segments[1] === "services" ? "service" : "resource",
                id: segments[2] ?? "new",
              }
            : undefined
        }
        backHref={segments[1] ? `${base}/settings` : base}
        getServiceHref={(id) => `${base}/settings/services/${id}`}
        getResourceHref={(id) => `${base}/settings/resources/${id}`}
        onSaved={(kind, id) => {
          if (segments[2] === "new")
            void navigate({
              to: `${base}/settings/${kind === "service" ? "services" : "resources"}/${id}`,
            });
        }}
      />
    );
  return (
    <ReservationsCalendar
      key={`${mock.generation}-${locale}`}
      client={mock.adminClient}
      locale={locale}
      labels={labels}
      initialDate={mock.initialDate}
      settingsHref={`${base}/settings`}
      linkComponent={Link}
      className="showroom-page"
    />
  );
}
