export type ReservationStatus = "pending" | "confirmed" | "rejected" | "cancelled";

export type ReservationMode = "appointment" | "stay";

export interface ReservationCommonPolicy {
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  cancellationMinutes: number;
  approval: "automatic" | "manual";
  noticeMinutes: number;
  horizonDays: number;
  intervalMinutes: number;
}

export interface ReservationAppointmentPolicy extends ReservationCommonPolicy {
  /** Missing mode on legacy documents means appointment. */
  mode?: "appointment";
  durationMinutes: number;
}

export interface ReservationStayPolicy extends ReservationCommonPolicy {
  mode: "stay";
  arrivalStart: string;
  arrivalEnd: string;
  checkoutTime: string;
  minNights: number;
  maxNights: number;
  durationMinutes?: never;
}

export type ReservationPolicy = ReservationAppointmentPolicy | ReservationStayPolicy;

export type ReservationService = ReservationPolicy & {
  id: string;
  version: number;
  name: string;
  description: string;
  resourceIds: string[];
  active: boolean;
  archived: boolean;
};

/** Local wall-clock intervals. An end of 24:00 means the end of that day. */
export interface ReservationHours {
  start: string;
  end: string;
}

export interface ReservationResource {
  id: string;
  version: number;
  name: string;
  active: boolean;
  archived: boolean;
  /** ISO weekdays 1 (Monday) through 7 (Sunday). Missing weekdays are closed. */
  weeklyHours: Record<string, ReservationHours[]>;
  /** Replaces the entire day's weekly hours; [] closes the date. */
  exceptions: Record<string, ReservationHours[]>;
  /** Inclusive local calendar dates; stay mode only. */
  blockedDates?: { from: string; through: string }[];
}

export interface ReservationSettings {
  version: number;
  timeZone: string;
  publicBookingEnabled: boolean;
}

export interface ReservationCustomer {
  name: string;
  email: string;
  phone: string;
}

export interface Reservation {
  mode: ReservationMode;
  departureDate?: string;
  nights?: number;
  id: string;
  version: number;
  serviceId: string;
  serviceName: string;
  resourceId: string;
  resourceName: string;
  status: ReservationStatus;
  startsAt: string;
  endsAt: string;
  occupiedStart: string;
  occupiedEnd: string;
  cancellationDeadline: string;
  timeZone: string;
  policy: ReservationPolicy;
  customer: ReservationCustomer;
  locale: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationCatalog {
  mode: ReservationMode;
  settings: ReservationSettings;
  services: ReservationService[];
  resources: Pick<ReservationResource, "id" | "name">[];
}

export interface ReservationSlot {
  startsAt: string;
  endsAt: string;
}

export interface ReservationAvailabilityQuery {
  serviceId: string;
  resourceId?: string;
  date: string;
  departureDate?: string;
}

export interface ReservationBookingInput {
  /** Required in stay mode; rejected in appointment mode. */
  departureDate?: string;
  requestId: string;
  serviceId: string;
  resourceId?: string;
  startsAt: string;
  customer: ReservationCustomer;
  locale: string;
}

export interface ReservationMoveInput {
  departureDate?: string;
  version: number;
  startsAt: string;
  resourceId?: string;
}

export interface ReservationRange {
  from: string;
  to: string;
  resourceId?: string;
  serviceId?: string;
  status?: ReservationStatus;
}

export interface ReservationAdminRecord extends Reservation {
  outsideHours: boolean;
  emailFailed: boolean;
}

export interface ReservationManagementView {
  reservation: Reservation;
  /** Current business zone used to select a new time. */
  timeZone: string;
  canChange: boolean;
  resources: Pick<ReservationResource, "id" | "name">[];
}

export interface ReservationConfiguration {
  mode: ReservationMode;
  settings: ReservationSettings;
  services: ReservationService[];
  resources: ReservationResource[];
}

export interface ReservationsPublicClient {
  catalog(): Promise<ReservationCatalog>;
  availability(query: ReservationAvailabilityQuery): Promise<ReservationSlot[]>;
  book(input: ReservationBookingInput): Promise<Reservation>;
}

/** The host binds the private link token to this client, never to admin operations. */
export interface ReservationManagementClient {
  get(): Promise<ReservationManagementView>;
  availability(query: {
    date: string;
    resourceId?: string;
    departureDate?: string;
  }): Promise<ReservationSlot[]>;
  cancel(version: number): Promise<Reservation>;
  reschedule(input: ReservationMoveInput): Promise<Reservation>;
}

export interface ReservationsAdminClient {
  configuration(): Promise<ReservationConfiguration>;
  list(range: ReservationRange): Promise<ReservationAdminRecord[]>;
  availability(
    query: ReservationAvailabilityQuery & { reservationId?: string },
  ): Promise<ReservationSlot[]>;
  book(input: ReservationBookingInput): Promise<Reservation>;
  reschedule(id: string, input: ReservationMoveInput): Promise<Reservation>;
  setStatus(id: string, version: number, status: ReservationStatus): Promise<Reservation>;
  saveSettings(input: ReservationSettings): Promise<ReservationSettings>;
  saveService(input: ReservationService): Promise<ReservationService>;
  saveResource(input: ReservationResource): Promise<ReservationResource>;
  retryEmail(id: string): Promise<void>;
  revokeLink(id: string, version: number): Promise<Reservation>;
}

export type ReservationErrorCode =
  | "MODE_MISMATCH"
  | "INVALID"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "CUTOFF"
  | "CLOSED"
  | "INVALID_LINK"
  | "STORAGE";

export class ReservationError extends Error {
  readonly code: ReservationErrorCode;
  constructor(code: ReservationErrorCode) {
    super(code);
    this.name = "ReservationError";
    this.code = code;
  }
}
