import "./drive-storage/register.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const { createBexioContactClient } =
  await import("../registry/components/connectors/customers-bexio/server/client.server.ts");
const { createBexioCustomerService, createBexioBulkImportService } =
  await import("../registry/components/connectors/customers-bexio/server/service.server.ts");
const { isRealCustomerEmail } =
  await import("../registry/components/connectors/customers-bexio/contracts.ts");
const { projectDriveScope } =
  await import("../registry/components/connectors/projects-drive/scope.ts");

// Adapted from TC's mocked per-customer Bexio regression checks.
await test("Bexio contact lifecycle preserves identity, partial writes, authorization and recovery", async () => {
  const person = {
    id: 7,
    contact_type_id: 2,
    name_1: "Lovelace",
    name_2: "Ada",
    mail: "ada@example.com",
    phone_fixed: "+41 27 000 00 00",
    user_id: 3,
    owner_id: 3,
  };
  const company = {
    ...person,
    id: 8,
    contact_type_id: 1,
    name_1: "Analytical Engines",
    name_2: null,
    mail: "billing@example.com",
    phone_fixed: "+41 27 111 11 11",
  };
  const customer = {
    localCustomerId: "customer-1",
    fullName: "Ada Lovelace",
    email: person.mail,
    language: "en",
    companyName: company.name_1,
    phone: person.phone_fixed,
    street: "Bahnhofstrasse 1",
    addressComplement: "Building C",
    postalCode: "8000",
    city: "Zurich",
    countryCode: "CH",
  };
  const baseLink = {
    id: "link-1",
    localCustomerId: customer.localCustomerId,
    bexioPersonId: person.id,
    bexioCompanyId: company.id,
    lastSyncedEmail: person.mail,
    syncStatus: "linked",
    lastSyncedAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const relation = { id: 1, contact_id: company.id, contact_sub_id: person.id };

  function harness({ contacts = [], relations = [], customers = [customer], links = [] } = {}) {
    const state = {
      contacts: new Map(contacts.map((value) => [value.id, { ...value }])),
      relations: relations.map((value) => ({ ...value })),
      customers: new Map(customers.map((value) => [value.localCustomerId, { ...value }])),
      links: new Map(links.map((value) => [value.localCustomerId, { ...value }])),
      requests: [],
      failRelation: false,
      updates: 0,
      revoked: 0,
      authorized: true,
      locks: 0,
      reads: 0,
      creates: 0,
      lockScopes: [],
      conflicts: new Set(),
      failUpdates: new Set(),
      failLinkOnce: false,
    };
    const client = createBexioContactClient({
      credentialProvider: {
        async getAccessToken() {
          return "test-token";
        },
      },
      request: async (url, init) => {
        const path = new URL(url).pathname;
        const body = init?.body ? JSON.parse(init.body) : null;
        state.requests.push({ path, body, method: init?.method || "GET" });
        assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-token");
        if (path === "/2.0/country")
          return Response.json([{ id: 41, name_short: "CH", iso3166_alpha2: "CH" }]);
        if (path === "/2.0/language")
          return Response.json([
            { id: 1, iso_639_1: "en" },
            { id: 2, iso_639_1: "fr" },
          ]);
        if (path === "/3.0/users/me") return Response.json({ id: 3, email: "owner@example.com" });
        if (path === "/2.0/contact_relation/search")
          return Response.json(
            state.relations.filter((row) =>
              body.every(({ field, value }) => String(row[field]) === value),
            ),
          );
        if (path === "/2.0/contact_relation") {
          if (!body) return Response.json(state.relations);
          if (state.failRelation) return Response.json({}, { status: 503 });
          state.relations.push({ id: state.relations.length + 1, ...body });
          // Match the documented non-relation response; the client must re-read the relationship.
          return Response.json(company);
        }
        if (path === "/2.0/contact/search")
          return Response.json(
            [...state.contacts.values()].filter((row) =>
              body.every(({ field, value, criteria }) =>
                criteria === "="
                  ? String(row[field]).toLowerCase() === value.toLowerCase()
                  : String(row[field]).toLowerCase().includes(value.toLowerCase()),
              ),
            ),
          );
        if (path === "/2.0/contact") {
          if (!body) return Response.json([...state.contacts.values()]);
          const contact = { id: 100 + state.contacts.size, ...body };
          state.contacts.set(contact.id, contact);
          return Response.json(contact);
        }
        const id = Number(path.split("/").at(-1));
        const contact = state.contacts.get(id);
        if (!contact) return Response.json({}, { status: 404 });
        if (body) Object.assign(contact, body);
        return Response.json(contact);
      },
    });
    const store = {
      async getByLocalCustomerId(id) {
        state.reads++;
        return state.links.get(id) ?? null;
      },
      async list() {
        return [...state.links.values()];
      },
      async upsert(input) {
        if (state.failLinkOnce) {
          state.failLinkOnce = false;
          throw new Error("Store unavailable");
        }
        assert.ok(
          ![...state.links.values()].some(
            (link) =>
              link.localCustomerId !== input.localCustomerId &&
              input.bexioPersonId &&
              link.bexioPersonId === input.bexioPersonId,
          ),
          "Person links must be unique",
        );
        const value = {
          id: "link-" + input.localCustomerId,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...input,
        };
        state.links.set(input.localCustomerId, value);
        return value;
      },
      async updateSyncState(id, input) {
        const value = state.links.get(id);
        assert.ok(value);
        Object.assign(value, input);
        return value;
      },
      async deleteByLocalCustomerId(id) {
        state.links.delete(id);
      },
    };
    const adapter = {
      async getCustomer(id) {
        const value = state.customers.get(id);
        assert.ok(value, "Customer exists");
        return value;
      },
    };
    const imports = {
      async findCustomersByEmails(emails) {
        const matches = new Map();
        for (const email of emails) {
          const match = [...state.customers.values()].find(
            (row) => row.email.toLowerCase() === email,
          );
          if (state.conflicts.has(email))
            matches.set(email, {
              status: "conflict",
              message: "This email belongs to a staff account.",
            });
          else if (match) matches.set(email, { status: "customer", customer: match });
        }
        return matches;
      },
      async createCustomer(input) {
        assert.ok(![...state.customers.values()].some((row) => row.email === input.email));
        const value = {
          ...customer,
          ...input,
          language: "en",
          localCustomerId: `imported-${++state.creates}`,
        };
        state.customers.set(value.localCustomerId, value);
        return value;
      },
      async updateCustomer(id, input, expectedEmail) {
        const value = state.customers.get(id);
        if (state.failUpdates.has(id)) throw new Error("Account update unavailable");
        assert.equal(value.email, expectedEmail, "Import checks the expected local email");
        if (
          [...state.customers.values()].some(
            (entry) => entry.localCustomerId !== id && entry.email === input.email,
          )
        )
          throw new Error("Another account already uses this email address");
        if (value.email !== input.email) state.revoked++;
        Object.assign(value, input);
        state.updates++;
        return value;
      },
    };
    const dependencies = {
      contactClient: client,
      linkStore: store,
      customerAdapter: adapter,
      customerImportAdapter: imports,
      host: {
        authorize: async () => state.authorized,
        async runExclusive(_id, operation) {
          state.locks++;
          state.lockScopes.push(_id);
          return operation();
        },
      },
    };
    return {
      state,
      client,
      service: createBexioCustomerService(dependencies),
      bulk: createBexioBulkImportService(dependencies),
    };
  }

  const importing = harness({ contacts: [person, company], relations: [relation], customers: [] });
  assert.equal((await importing.bulk.syncAllContacts()).created, 1);
  assert.equal(importing.state.customers.size, 1);
  assert.equal(importing.state.links.size, 1);
  assert.deepEqual(
    importing.state.lockScopes,
    [undefined],
    "One installation lock, with no nested per-customer locks",
  );
  assert.equal((await importing.bulk.syncAllContacts()).updated, 1);
  assert.equal(importing.state.creates, 1, "Retry does not recreate accounts");
  assert.equal((await importing.bulk.listLinks()).length, 1);
  importing.state.authorized = false;
  const beforeDenied = importing.state.requests.length;
  await assert.rejects(importing.bulk.syncAllContacts(), /Access denied/);
  await assert.rejects(importing.bulk.listLinks(), /Access denied/);
  assert.equal(importing.state.requests.length, beforeDenied);

  const matching = harness({ contacts: [person, company], relations: [relation] });
  assert.equal((await matching.bulk.syncAllContacts()).linked, 1);
  assert.equal(matching.state.creates, 0);
  const legacyBulk = harness({
    contacts: [person, company],
    relations: [relation],
    links: [{ ...baseLink, bexioPersonId: null }],
  });
  assert.equal((await legacyBulk.bulk.syncAllContacts()).updated, 1);
  assert.equal(legacyBulk.state.links.get(customer.localCustomerId).bexioPersonId, person.id);
  const ambiguousBulk = harness({
    contacts: [person, { ...person, id: 9, mail: "grace@example.com" }, company],
    relations: [relation, { ...relation, id: 2, contact_sub_id: 9 }],
    customers: [],
  });
  assert.equal((await ambiguousBulk.bulk.syncAllContacts()).created, 0);
  const duplicates = harness({ contacts: [person, { ...person, id: 9 }], customers: [] });
  assert.equal((await duplicates.bulk.syncAllContacts()).created, 0);
  const invalidContact = harness({
    contacts: [{ ...person, mail: "placeholder@customers.invalid" }, company],
    customers: [],
  });
  assert.equal((await invalidContact.bulk.syncAllContacts()).created, 0);
  const staffConflict = harness({ contacts: [person], customers: [] });
  staffConflict.state.conflicts.add(person.mail);
  assert.equal((await staffConflict.bulk.syncAllContacts()).created, 0);
  const partialImport = harness({ contacts: [person], customers: [] });
  partialImport.state.failLinkOnce = true;
  assert.equal((await partialImport.bulk.syncAllContacts()).failed, 1);
  assert.equal(partialImport.state.customers.size, 1);
  assert.equal((await partialImport.bulk.syncAllContacts()).linked, 1);
  assert.equal(
    partialImport.state.creates,
    1,
    "Persisted accounts survive a failed link write and are matched on retry",
  );
  const anotherPerson = {
    ...person,
    id: 9,
    mail: "grace@example.com",
    name_1: "Hopper",
    name_2: "Grace",
  };
  const partialExisting = harness({
    contacts: [person, anotherPerson],
    links: [{ ...baseLink, bexioCompanyId: null }],
  });
  partialExisting.state.failUpdates.add(customer.localCustomerId);
  const partialResult = await partialExisting.bulk.syncAllContacts();
  assert.equal(partialResult.failed, 1);
  assert.equal(partialResult.created, 1, "A failed existing account does not block other contacts");
  assert.equal(partialExisting.state.links.get(customer.localCustomerId).syncStatus, "error");
  const emailReview = harness({
    contacts: [{ ...person, mail: "changed@example.com" }],
    links: [{ ...baseLink, bexioCompanyId: null }],
  });
  assert.ok((await emailReview.bulk.syncAllContacts()).skipped > 0);
  assert.equal(
    emailReview.state.customers.get(customer.localCustomerId).email,
    customer.email,
    "Bulk import never changes an existing login email",
  );

  const automatic = harness({ contacts: [person, company], links: [baseLink] });
  automatic.state.customers.get(customer.localCustomerId).fullName = "Saved name";
  assert.equal(await automatic.service.syncSavedCustomer(customer.localCustomerId), null);
  assert.equal(automatic.state.contacts.get(person.id).name_1, "Saved name");
  assert.deepEqual(automatic.state.lockScopes, [customer.localCustomerId]);
  automatic.state.failRelation = true;
  automatic.state.relations = [];
  automatic.state.customers.get(customer.localCustomerId).fullName = "Still saved";
  assert.match(await automatic.service.syncSavedCustomer(customer.localCustomerId), /failed/);
  assert.equal(automatic.state.customers.get(customer.localCustomerId).fullName, "Still saved");
  automatic.state.failRelation = false;
  assert.equal(await automatic.service.syncSavedCustomer(customer.localCustomerId), null);
  automatic.state.authorized = false;
  assert.match(
    await automatic.service.syncSavedCustomer(customer.localCustomerId),
    /Customer saved/,
  );
  const unlinked = harness();
  assert.equal(await unlinked.service.syncSavedCustomer(customer.localCustomerId), null);
  assert.equal(
    unlinked.state.requests.length,
    0,
    "Automatic sync does not provision unlinked contacts",
  );

  assert.equal(isRealCustomerEmail("customer-123@customers.invalid"), false);
  assert.equal(isRealCustomerEmail("ada@example.com"), true);
  const individual = harness({ customers: [{ ...customer, companyName: null }] });
  const createdPerson = await individual.service.createContact({
    localCustomerId: customer.localCustomerId,
    contactType: "person",
  });
  assert.ok(createdPerson.bexioPersonId);
  assert.equal(createdPerson.bexioCompanyId, null);
  assert.equal(
    individual.state.contacts.get(createdPerson.bexioPersonId).name_1,
    customer.fullName,
  );
  assert.equal(individual.state.contacts.get(createdPerson.bexioPersonId).name_2, null);
  assert.equal(
    individual.state.contacts.get(createdPerson.bexioPersonId).street_name,
    customer.street,
  );
  assert.equal(
    individual.state.contacts.get(createdPerson.bexioPersonId).postcode,
    customer.postalCode,
  );
  assert.equal(individual.state.contacts.get(createdPerson.bexioPersonId).city, customer.city);
  assert.equal(individual.state.contacts.get(createdPerson.bexioPersonId).country_id, 41);
  assert.equal(individual.state.contacts.get(createdPerson.bexioPersonId).language_id, 1);
  const unknownCountry = harness({
    customers: [{ ...customer, companyName: null, countryCode: "XX" }],
  });
  await assert.rejects(
    unknownCountry.service.createContact({
      localCustomerId: customer.localCustomerId,
      contactType: "person",
    }),
    /Country XX was not found/,
  );
  assert.equal(unknownCountry.state.contacts.size, 0);

  const singleName = harness({ customers: [{ ...customer, fullName: "Cher" }] });
  const singleNameLink = await singleName.service.createContact({
    localCustomerId: customer.localCustomerId,
    contactType: "person",
  });
  assert.equal(singleName.state.contacts.get(singleNameLink.bexioPersonId).name_1, "Cher");
  assert.equal(singleName.state.contacts.get(singleNameLink.bexioPersonId).name_2, null);
  assert.equal(
    (await singleName.service.previewImport(customer.localCustomerId)).contact.fullName,
    "Cher",
  );
  await individual.service.createContact({
    localCustomerId: customer.localCustomerId,
    contactType: "person",
  });
  assert.equal(individual.state.contacts.size, 1, "Retry reuses the saved person");
  const incomplete = harness({ customers: [{ ...customer, email: "draft@customers.invalid" }] });
  await assert.rejects(
    incomplete.service.createContact({
      localCustomerId: customer.localCustomerId,
      contactType: "person",
    }),
    /real email/,
  );
  assert.equal(incomplete.state.requests.length, 0);
  const missingNames = harness({ customers: [{ ...customer, fullName: "" }] });
  await assert.rejects(
    missingNames.service.createContact({
      localCustomerId: customer.localCustomerId,
      contactType: "person",
    }),
    /fullName|full name/,
  );

  const pair = harness();
  await pair.service.createContact({
    localCustomerId: customer.localCustomerId,
    contactType: "company",
  });
  pair.state.failRelation = true;
  const partial = await pair.service.createContact({
    localCustomerId: customer.localCustomerId,
    contactType: "person",
  });
  assert.equal(partial.syncStatus, "error");
  assert.ok(
    partial.bexioPersonId && partial.bexioCompanyId,
    "Both IDs survive relationship failure",
  );
  pair.state.failRelation = false;
  const retriedPair = await pair.service.createContact({
    localCustomerId: customer.localCustomerId,
    contactType: "person",
  });
  assert.equal(retriedPair.syncStatus, "linked", "A successful retry clears the error state");
  assert.equal(retriedPair.lastError, null);
  assert.equal(pair.state.contacts.size, 2);
  assert.equal(pair.state.relations.length, 1);
  await pair.client.ensureRelation(partial.bexioCompanyId, partial.bexioPersonId);
  assert.equal(pair.state.relations.length, 1, "Relationship retries are idempotent");
  const companyPayload = pair.state.requests.find(
    (request) => request.body?.contact_type_id === 1,
  ).body;
  assert.equal("mail" in companyPayload, false);
  assert.equal("phone_fixed" in companyPayload, false);
  assert.equal(companyPayload.street_name, customer.street);
  assert.equal(companyPayload.address_addition, customer.addressComplement);
  assert.equal(companyPayload.postcode, customer.postalCode);
  assert.equal(companyPayload.city, customer.city);
  assert.equal(companyPayload.country_id, 41);
  assert.equal(companyPayload.language_id, 1);
  const personPayload = pair.state.requests.find(
    (request) => request.body?.contact_type_id === 2,
  ).body;
  assert.equal("street_name" in personPayload, false, "Company owns the billing address");

  const companyOnly = harness({
    contacts: [{ ...company, name_1: "Old name", street_name: "Old street" }],
    links: [{ ...baseLink, bexioPersonId: null, lastSyncedEmail: null }],
  });
  assert.equal((await companyOnly.service.syncContact(customer.localCustomerId)).status, "synced");
  assert.equal(companyOnly.state.contacts.get(company.id).name_1, customer.companyName);
  assert.equal(companyOnly.state.contacts.get(company.id).street_name, customer.street);
  const companyOnlyLink = companyOnly.state.links.get(customer.localCustomerId);
  assert.equal(companyOnly.state.contacts.get(companyOnlyLink.bexioPersonId).mail, customer.email);
  assert.equal(
    companyOnly.state.contacts.get(companyOnlyLink.bexioPersonId).name_1,
    customer.fullName,
  );
  assert.equal(companyOnlyLink.lastSyncedEmail, customer.email);
  assert.equal(companyOnly.state.relations.length, 1);
  assert.equal(
    (await companyOnly.service.previewImport(customer.localCustomerId)).bexioPersonId,
    companyOnlyLink.bexioPersonId,
  );
  assert.equal((await companyOnly.service.syncContact(customer.localCustomerId)).status, "synced");
  assert.equal(companyOnly.state.contacts.size, 2, "Push retries reuse the About contact person");

  const existingPerson = harness({
    contacts: [person, company],
    links: [{ ...baseLink, bexioPersonId: null, lastSyncedEmail: null }],
  });
  assert.equal(
    (await existingPerson.service.syncContact(customer.localCustomerId)).status,
    "synced",
  );
  assert.equal(existingPerson.state.links.get(customer.localCustomerId).bexioPersonId, person.id);
  assert.equal(existingPerson.state.contacts.size, 2, "Exact email match is linked, not recreated");
  assert.equal(existingPerson.state.contacts.get(person.id).name_1, customer.fullName);
  assert.equal(existingPerson.state.relations.length, 1);

  const ambiguousPerson = harness({
    contacts: [person, { ...person, id: 9 }, company],
    links: [{ ...baseLink, bexioPersonId: null, lastSyncedEmail: null }],
  });
  assert.equal(
    (await ambiguousPerson.service.syncContact(customer.localCustomerId)).status,
    "error",
  );
  assert.equal(ambiguousPerson.state.links.get(customer.localCustomerId).bexioPersonId, null);
  assert.equal(ambiguousPerson.state.contacts.size, 3);
  const alreadyLinkedPerson = harness({
    contacts: [person, company],
    links: [
      { ...baseLink, localCustomerId: "other", bexioCompanyId: null },
      { ...baseLink, bexioPersonId: null, lastSyncedEmail: null },
    ],
  });
  assert.equal(
    (await alreadyLinkedPerson.service.syncContact(customer.localCustomerId)).status,
    "error",
  );
  assert.equal(alreadyLinkedPerson.state.links.get(customer.localCustomerId).bexioPersonId, null);

  const staleLink = harness({
    contacts: [person, company],
    relations: [relation],
    customers: [],
    links: [baseLink],
  });
  assert.equal((await staleLink.bulk.syncAllContacts()).failed, 1);
  assert.equal(
    staleLink.state.creates,
    0,
    "A broken existing link must not create a replacement account",
  );

  const linked = harness({ contacts: [person, company], relations: [relation], links: [baseLink] });
  const searched = await linked.client.searchContacts(company.name_1, "company");
  assert.deepEqual(
    searched.map((entry) => entry.id),
    [company.id],
  );
  await assert.rejects(
    linked.service.linkContact(customer.localCustomerId, company.id, "person"),
    /correct Bexio contact type/,
  );
  linked.state.customers.get(customer.localCustomerId).email = "new-ada@example.com";
  linked.state.customers.get(customer.localCustomerId).language = "fr";
  assert.equal((await linked.service.syncContact(customer.localCustomerId)).status, "synced");
  assert.equal(linked.state.contacts.get(person.id).language_id, 2);
  assert.equal(linked.state.contacts.get(company.id).language_id, 2);
  assert.equal(linked.state.contacts.get(person.id).mail, "new-ada@example.com");
  assert.equal(linked.state.contacts.get(company.id).mail, company.mail);
  assert.equal(linked.state.contacts.get(company.id).phone_fixed, company.phone_fixed);
  assert.equal(linked.state.contacts.get(company.id).street_name, customer.street);
  assert.equal(linked.state.contacts.get(company.id).country_id, 41);
  assert.equal(linked.state.contacts.get(person.id).street_name, undefined);
  const sparse = harness({
    contacts: [person, { ...company, street_name: "Existing street", country_id: 99 }],
    links: [baseLink],
    customers: [
      {
        ...customer,
        street: null,
        addressComplement: null,
        postalCode: null,
        city: null,
        countryCode: null,
      },
    ],
  });
  assert.equal((await sparse.service.syncContact(customer.localCustomerId)).status, "synced");
  assert.equal(sparse.state.contacts.get(company.id).street_name, "Existing street");
  assert.equal(sparse.state.contacts.get(company.id).country_id, 99);

  linked.state.contacts.get(person.id).mail = "remote-ada@example.com";
  assert.equal((await linked.service.syncContact(customer.localCustomerId)).status, "error");
  const preview = await linked.service.previewImport(customer.localCustomerId);
  linked.state.contacts.get(person.id).mail = "changed-again@example.com";
  await assert.rejects(linked.service.confirmImport(preview), /changed since this preview/);
  assert.equal(linked.state.updates, 0);
  linked.state.contacts.get(person.id).mail = preview.expectedRemoteEmail;
  linked.state.customers.set("other", {
    ...customer,
    localCustomerId: "other",
    email: preview.expectedRemoteEmail,
  });
  await assert.rejects(linked.service.confirmImport(preview), /Another account/);
  linked.state.customers.delete("other");
  await linked.service.confirmImport(preview);
  assert.equal(
    linked.state.customers.get(customer.localCustomerId).email,
    preview.expectedRemoteEmail,
  );
  assert.equal(linked.state.revoked, 1);
  const beforeUnlink = linked.state.contacts.size;
  await linked.service.unlinkContact(customer.localCustomerId, "company");
  assert.equal(linked.state.contacts.size, beforeUnlink);
  assert.equal(
    linked.state.relations.length,
    1,
    "Local unlink does not delete remote relationships",
  );
  assert.equal(linked.state.links.get(customer.localCustomerId).bexioCompanyId, null);

  const denied = harness({ contacts: [person], links: [baseLink] });
  denied.state.authorized = false;
  for (const operation of [
    () => denied.service.getLink(customer.localCustomerId),
    () => denied.service.searchContacts("Ada", "person"),
    () => denied.service.linkContact(customer.localCustomerId, person.id, "person"),
    () =>
      denied.service.createContact({
        localCustomerId: customer.localCustomerId,
        contactType: "person",
      }),
    () => denied.service.unlinkContact(customer.localCustomerId, "person"),
    () => denied.service.syncContact(customer.localCustomerId),
    () => denied.service.previewImport(customer.localCustomerId),
    () => denied.service.confirmImport(preview),
  ])
    await assert.rejects(async () => operation(), /Access denied/);
  assert.equal(denied.state.requests.length, 0);
  assert.equal(denied.state.reads, 0);
  assert.equal(denied.state.locks, 0);
  denied.state.authorized = true;
  for (const operation of [
    () => denied.service.getLink(null),
    () => denied.service.searchContacts({}, "person"),
    () => denied.service.searchContacts("Ada", "invalid"),
    () => denied.service.linkContact(customer.localCustomerId, -1, "person"),
    () => denied.service.createContact(null),
    () => denied.service.unlinkContact("", "person"),
    () => denied.service.syncContact([]),
    () => denied.service.previewImport(null),
    () => denied.service.confirmImport({}),
  ])
    await assert.rejects(async () => operation());
  assert.equal(denied.state.requests.length, 0);
  assert.equal(denied.state.reads, 0);
  assert.equal(denied.state.locks, 0);

  const staleName = harness({ contacts: [person, company], links: [baseLink] });
  const reviewed = await staleName.service.previewImport(customer.localCustomerId);
  staleName.state.contacts.get(person.id).name_1 = "Changed name";
  await assert.rejects(staleName.service.confirmImport(reviewed), /changed since this preview/);
  assert.equal(staleName.state.updates, 0);
  assert.ok(staleName.state.locks > 0);
  const occupied = harness({
    contacts: [person],
    links: [{ ...baseLink, localCustomerId: "other" }],
  });
  await assert.rejects(
    occupied.service.linkContact(customer.localCustomerId, person.id, "person"),
    /another customer/,
  );
  assert.equal(occupied.state.links.has(customer.localCustomerId), false);
  const unauthorized = createBexioContactClient({
    credentialProvider: {
      async getAccessToken() {
        return "never-expose-this";
      },
    },
    request: async () => Response.json({}, { status: 401 }),
  });
  await assert.rejects(
    unauthorized.getContact(1),
    (error) =>
      /authentication failed/.test(error.message) && !error.message.includes("never-expose-this"),
  );
});

await test("connector packages keep base plugins independent and browser exports server-free", async () => {
  const manifest = JSON.parse(await readFile("registry/registry.json", "utf8"));
  for (const name of ["customers-bexio", "projects-drive"]) {
    const connector = manifest.items.find((item) => item.name === name);
    assert.ok(connector);
    for (const file of connector.files) {
      assert.ok(file.target.startsWith("@components/connectors/"));
      const source = await readFile(file.path, "utf8");
      assert.doesNotMatch(source, /from ["'][^"']*(?:server|showroom|src\/lib)/);
    }
  }
  for (const name of ["customers", "projects", "drive"]) {
    const base = manifest.items.find((item) => item.name === name);
    assert.ok(
      !base.registryDependencies.some((item) => /customers-bexio|projects-drive/.test(item)),
    );
  }
  assert.deepEqual(projectDriveScope({ id: "project-a" }), { type: "project", id: "project-a" });
  assert.deepEqual(projectDriveScope({ id: "project-b" }), { type: "project", id: "project-b" });
});

await test("Bexio HTTP adapter validates responses and never retries provider failures", async () => {
  for (const response of [
    () =>
      Response.json(
        { secret: "private-response" },
        { status: 429, headers: { "RateLimit-Reset": "30" } },
      ),
    () => Response.json({ secret: "private-response" }),
    () => new Response("private-response", { status: 200 }),
  ]) {
    let calls = 0;
    const client = createBexioContactClient({
      credentialProvider: { getAccessToken: async () => "private-token" },
      request: async () => {
        calls++;
        return response();
      },
    });
    await assert.rejects(
      client.getContact(1),
      (error) => !/private-response|private-token/.test(error.message),
    );
    assert.equal(calls, 1);
  }
  let requested = false;
  const client = createBexioContactClient({
    credentialProvider: { getAccessToken: async () => "" },
    request: async () => {
      requested = true;
      return Response.json({});
    },
  });
  await assert.rejects(client.getContact(1), /not configured/);
  assert.equal(requested, false);
});

await test("bulk listing paginates and a provider failure stops before importing", async () => {
  const offsets = [];
  const client = createBexioContactClient({
    credentialProvider: { getAccessToken: async () => "test-token" },
    request: async (url) => {
      const offset = Number(new URL(url).searchParams.get("offset"));
      offsets.push(offset);
      return Response.json(
        Array.from({ length: offset ? 1 : 500 }, (_, index) => ({
          id: offset + index + 1,
          contact_type_id: 2,
          name_1: "Example",
          user_id: 1,
          owner_id: 1,
        })),
      );
    },
  });
  assert.equal((await client.listContacts()).length, 501);
  assert.deepEqual(offsets, [0, 500]);
  let touchedCustomers = false;
  const bulk = createBexioBulkImportService({
    contactClient: {
      listContacts: async () => {
        throw new Error("Unavailable");
      },
      listRelations: async () => [],
    },
    linkStore: { list: async () => [] },
    customerAdapter: {},
    customerImportAdapter: {
      findCustomersByEmails: async () => {
        touchedCustomers = true;
        return new Map();
      },
    },
    host: { authorize: async () => true, runExclusive: async (_scope, action) => action() },
  });
  await assert.rejects(bulk.syncAllContacts(), /Unavailable/);
  assert.equal(touchedCustomers, false);
});
