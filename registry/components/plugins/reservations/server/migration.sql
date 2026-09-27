CREATE TABLE reservations_settings (id text PRIMARY KEY CHECK (id = 'business'), document jsonb NOT NULL);
CREATE TABLE reservations_resource (id text PRIMARY KEY, document jsonb NOT NULL);
CREATE TABLE reservations_service (id text PRIMARY KEY, document jsonb NOT NULL);
CREATE TABLE reservations_booking (
  id text PRIMARY KEY, document jsonb NOT NULL,
  request_id text NOT NULL UNIQUE, request_hash text NOT NULL,
  token_version integer NOT NULL DEFAULT 1,
  resource_id text NOT NULL REFERENCES reservations_resource(id),
  service_id text NOT NULL REFERENCES reservations_service(id),
  starts_at timestamptz NOT NULL, occupied_end timestamptz NOT NULL,
  CHECK (occupied_end > starts_at)
);
CREATE INDEX reservations_booking_range ON reservations_booking(starts_at, occupied_end);
CREATE INDEX reservations_booking_resource ON reservations_booking(resource_id);
CREATE TABLE reservations_notification (
  id text PRIMARY KEY, reservation_id text NOT NULL REFERENCES reservations_booking(id),
  version integer NOT NULL, kind text NOT NULL, document jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0, next_attempt timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz, lease_id text, sent_at timestamptz, error text,
  UNIQUE (reservation_id, version)
);
CREATE INDEX reservations_notification_due ON reservations_notification(sent_at, next_attempt);
