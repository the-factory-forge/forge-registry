import { z } from "zod";

import {
  confirmBexioImportSchema,
  forgeCustomerSchema,
  bexioContactTypeSchema,
  type BexioContactLinkActions,
  type BexioHostAdapter,
  type BexioBulkContactClient,
  type ForgeCustomerBulkImportAdapter,
  type BexioBulkSyncResult,
  type BexioCustomerDirectoryActions,
  createAndLinkBexioContactInputSchema,
  forgeCustomerImportInputSchema,
  isRealCustomerEmail,
  type BexioContact,
  type BexioContactClient,
  type BexioContactLink,
  type BexioContactLinkStore,
  type BexioContactType,
  type BexioImportPreview,
  type BexioSyncResult,
  type ForgeCustomer,
  type ForgeCustomerAdapter,
  type ForgeCustomerImportAdapter,
} from "@/components/connectors/customers-bexio/contracts";
import {
  BexioApiError,
  getSafeBexioErrorMessage,
} from "@/components/connectors/customers-bexio/server/client.server";

const normalizeEmail = (email: string | null | undefined) => email?.trim().toLowerCase() ?? "";
const EMAIL_REVIEW =
  "The Bexio person email differs from the login email. Review the import in the customer's Sync tab and confirm the change.";

function importContact(person: BexioContact, company: BexioContact | null) {
  if (person.contact_type_id !== 2 || (company && company.contact_type_id !== 1)) {
    throw new BexioApiError("The linked Bexio contact type changed. Review the contact links.");
  }
  const parsed = forgeCustomerImportInputSchema.safeParse({
    fullName: [person.name_2?.trim(), person.name_1.trim()].filter(Boolean).join(" "),
    email: normalizeEmail(person.mail),
    phone: person.phone_fixed?.trim() || null,
    companyName: company?.name_1.trim() || null,
  });
  if (!parsed.success)
    throw new BexioApiError("The Bexio person needs a full name and valid email before import.");
  return parsed.data;
}

function linkValues(localCustomerId: string, link: BexioContactLink | null) {
  return {
    localCustomerId,
    bexioPersonId: link?.bexioPersonId ?? null,
    bexioCompanyId: link?.bexioCompanyId ?? null,
    lastSyncedEmail: link?.lastSyncedEmail ?? null,
    lastSyncedAt: link?.lastSyncedAt ?? null,
    lastError: null,
  };
}

export function createBexioCustomerService({
  contactClient,
  linkStore,
  customerAdapter: hostCustomers,
  customerImportAdapter,
  host,
}: {
  contactClient: BexioContactClient;
  linkStore: BexioContactLinkStore;
  customerAdapter: ForgeCustomerAdapter;
  customerImportAdapter: ForgeCustomerImportAdapter;
  host: BexioHostAdapter;
}) {
  const customerAdapter: ForgeCustomerAdapter = {
    async getCustomer(id) {
      const customer = forgeCustomerSchema.parse(await hostCustomers.getCustomer(id));
      if (customer.localCustomerId !== id) throw new BexioApiError("Customer identity mismatch.");
      return customer;
    },
  };
  async function connect(link: BexioContactLink) {
    try {
      if (link.bexioPersonId && link.bexioCompanyId) {
        await contactClient.ensureRelation(link.bexioCompanyId, link.bexioPersonId);
      }
      return linkStore.updateSyncState(link.localCustomerId, {
        syncStatus: "linked",
        lastSyncedAt: link.lastSyncedAt,
        lastError: null,
      });
    } catch (error) {
      return linkStore.updateSyncState(link.localCustomerId, {
        syncStatus: "error",
        lastSyncedAt: link.lastSyncedAt,
        lastError: getSafeBexioErrorMessage(error),
      });
    }
  }

  async function attach(
    localCustomerId: string,
    contact: BexioContact,
    contactType: BexioContactType,
  ) {
    const customer = await customerAdapter.getCustomer(localCustomerId);
    if (contact.contact_type_id !== (contactType === "company" ? 1 : 2))
      throw new BexioApiError("Select the correct Bexio contact type.");
    if (
      contactType === "person" &&
      (await linkStore.list()).some(
        (other) => other.localCustomerId !== localCustomerId && other.bexioPersonId === contact.id,
      )
    )
      throw new BexioApiError("This Bexio person is linked to another customer.");
    const previous = await linkStore.getByLocalCustomerId(localCustomerId);
    const link = await linkStore.upsert({
      ...linkValues(localCustomerId, previous),
      ...(contactType === "person"
        ? {
            bexioPersonId: contact.id,
            lastSyncedEmail:
              normalizeEmail(contact.mail) === normalizeEmail(customer.email)
                ? normalizeEmail(customer.email)
                : null,
          }
        : { bexioCompanyId: contact.id }),
      syncStatus: "linked",
    });
    // Persist each external ID before the next request, so a failed relationship is retryable.
    return connect(link);
  }

  async function createRemoteContact(customer: ForgeCustomer, contactType: BexioContactType) {
    const owner = await contactClient.getAuthenticatedUser();
    const billingAddress =
      contactType === "company" || !customer.companyName?.trim() ? customer : null;
    return contactClient.createContact({
      contactType,
      companyName: customer.companyName?.trim() || null,
      fullName: customer.fullName.trim() || null,
      email: contactType === "person" ? customer.email : null,
      language: customer.language,
      phone: contactType === "person" ? customer.phone?.trim() || null : null,
      street: billingAddress?.street?.trim() || null,
      addressComplement: billingAddress?.addressComplement?.trim() || null,
      postalCode: billingAddress?.postalCode?.trim() || null,
      city: billingAddress?.city?.trim() || null,
      countryCode: billingAddress?.countryCode?.trim().toUpperCase() || null,
      ownerId: owner.id,
    });
  }

  async function ensurePrimaryContactLink(customer: ForgeCustomer, link: BexioContactLink) {
    if (link.bexioPersonId) return link;
    if (!customer.fullName.trim() || !isRealCustomerEmail(customer.email))
      throw new BexioApiError("Save the contact person's full name and real email in About first.");

    const matches = (
      await contactClient.searchContacts(normalizeEmail(customer.email), "person", true)
    ).filter((contact) => normalizeEmail(contact.mail) === normalizeEmail(customer.email));
    if (matches.length > 1)
      throw new BexioApiError(
        "Several Bexio people use this email. Search and link the primary contact manually.",
      );
    const match = matches[0];
    if (match) {
      if (
        (await linkStore.list()).some(
          (other) =>
            other.localCustomerId !== customer.localCustomerId && other.bexioPersonId === match.id,
        )
      )
        throw new BexioApiError(
          "This Bexio person is linked to another customer. Review the contact links.",
        );
      return attach(customer.localCustomerId, match, "person");
    }

    const person = await createRemoteContact(customer, "person");
    return attach(customer.localCustomerId, person, "person");
  }

  async function previewImport(localCustomerId: string): Promise<BexioImportPreview> {
    const customer = await customerAdapter.getCustomer(localCustomerId);
    const link = await linkStore.getByLocalCustomerId(localCustomerId);
    if (!link?.bexioPersonId) throw new BexioApiError("Link a contact person before importing.");
    const [person, company] = await Promise.all([
      contactClient.getContact(link.bexioPersonId),
      link.bexioCompanyId ? contactClient.getContact(link.bexioCompanyId) : null,
    ]);
    const contact = importContact(person, company);
    return {
      localCustomerId,
      bexioPersonId: person.id,
      bexioCompanyId: company?.id ?? null,
      expectedLocalEmail: normalizeEmail(customer.email),
      expectedRemoteEmail: contact.email,
      contact,
    };
  }

  const actions = {
    async getLink(localCustomerId: string) {
      await customerAdapter.getCustomer(localCustomerId);
      return linkStore.getByLocalCustomerId(localCustomerId);
    },
    searchContacts(query: string, contactType: BexioContactType) {
      return contactClient.searchContacts(query, contactType);
    },
    async linkContact(
      localCustomerId: string,
      bexioContactId: number,
      contactType: BexioContactType,
    ) {
      await customerAdapter.getCustomer(localCustomerId);
      return attach(localCustomerId, await contactClient.getContact(bexioContactId), contactType);
    },
    async createContact(input: unknown) {
      const { localCustomerId, contactType } = createAndLinkBexioContactInputSchema.parse(input);
      const customer = await customerAdapter.getCustomer(localCustomerId);
      const link = await linkStore.getByLocalCustomerId(localCustomerId);
      if (link && (contactType === "person" ? link.bexioPersonId : link.bexioCompanyId))
        return connect(link);
      if (
        contactType === "person" &&
        (!customer.fullName.trim() || !isRealCustomerEmail(customer.email))
      ) {
        throw new BexioApiError(
          "Save the contact person's full name and real email in About first.",
        );
      }
      if (contactType === "company" && !customer.companyName?.trim())
        throw new BexioApiError("Save the company name in About first.");
      const query = contactType === "person" ? customer.email : (customer.companyName ?? "");
      const matches = (await contactClient.searchContacts(query, contactType, true)).filter(
        (contact) =>
          contactType === "person"
            ? normalizeEmail(contact.mail) === normalizeEmail(customer.email)
            : contact.name_1.trim().toLowerCase() === query.trim().toLowerCase(),
      );
      if (matches.length)
        throw new BexioApiError(
          "A matching Bexio contact already exists. Search and link it instead of creating a duplicate.",
        );
      const contact = await createRemoteContact(customer, contactType);
      return attach(localCustomerId, contact, contactType);
    },
    async unlinkContact(localCustomerId: string, contactType: BexioContactType) {
      await customerAdapter.getCustomer(localCustomerId);
      const link = await linkStore.getByLocalCustomerId(localCustomerId);
      if (!link) return;
      const values = {
        ...linkValues(localCustomerId, link),
        ...(contactType === "person"
          ? { bexioPersonId: null, lastSyncedEmail: null }
          : { bexioCompanyId: null }),
      };
      if (!values.bexioPersonId && !values.bexioCompanyId)
        await linkStore.deleteByLocalCustomerId(localCustomerId);
      else await linkStore.upsert({ ...values, syncStatus: "linked" });
    },
    async syncContact(localCustomerId: string): Promise<BexioSyncResult> {
      const existingLink = await linkStore.getByLocalCustomerId(localCustomerId);
      if (!existingLink?.bexioPersonId && !existingLink?.bexioCompanyId)
        return { status: "not-linked" };
      await linkStore.updateSyncState(localCustomerId, {
        syncStatus: "pending",
        lastSyncedAt: existingLink.lastSyncedAt,
        lastError: null,
      });
      try {
        const customer = await customerAdapter.getCustomer(localCustomerId);
        if (existingLink.bexioCompanyId && !customer.companyName?.trim())
          throw new BexioApiError(
            "The company name is empty. Restore it or unlink the company explicitly.",
          );
        const link = await ensurePrimaryContactLink(customer, existingLink);
        if (!link.bexioPersonId)
          throw new BexioApiError("The primary contact could not be linked.");
        const person = await contactClient.getContact(link.bexioPersonId);
        const remoteEmail = normalizeEmail(person.mail);
        if (
          remoteEmail &&
          remoteEmail !== normalizeEmail(customer.email) &&
          remoteEmail !== link.lastSyncedEmail
        )
          throw new BexioApiError(EMAIL_REVIEW);
        await contactClient.updateContact(link.bexioPersonId, customer, "person");
        // Record the successful person write even if the company request fails afterwards.
        await linkStore.updateSyncState(localCustomerId, {
          syncStatus: "pending",
          lastSyncedAt: link.lastSyncedAt,
          lastError: null,
          lastSyncedEmail: normalizeEmail(customer.email),
        });
        if (link.bexioCompanyId) {
          await contactClient.updateContact(link.bexioCompanyId, customer, "company");
          await contactClient.ensureRelation(link.bexioCompanyId, link.bexioPersonId);
        }
        const synced = await linkStore.updateSyncState(localCustomerId, {
          syncStatus: "synced",
          lastSyncedAt: new Date(),
          lastError: null,
        });
        return { status: "synced", link: synced };
      } catch (error) {
        const message = getSafeBexioErrorMessage(error);
        const failed = await linkStore.updateSyncState(localCustomerId, {
          syncStatus: "error",
          lastSyncedAt: existingLink.lastSyncedAt,
          lastError: message,
        });
        return { status: "error", link: failed, message };
      }
    },
    previewImport,
    async confirmImport(input: unknown) {
      const expected = confirmBexioImportSchema.parse(input);
      const preview = await previewImport(expected.localCustomerId);
      if (
        preview.bexioPersonId !== expected.bexioPersonId ||
        preview.bexioCompanyId !== expected.bexioCompanyId ||
        preview.expectedLocalEmail !== expected.expectedLocalEmail ||
        preview.expectedRemoteEmail !== expected.expectedRemoteEmail ||
        JSON.stringify(preview.contact) !== JSON.stringify(expected.contact)
      ) {
        throw new BexioApiError(
          "The contact or email changed since this preview. Review the import again.",
        );
      }
      if (preview.bexioCompanyId)
        await contactClient.ensureRelation(preview.bexioCompanyId, preview.bexioPersonId);
      await customerImportAdapter.updateCustomer(
        preview.localCustomerId,
        preview.contact,
        preview.expectedLocalEmail,
      );
      return linkStore.updateSyncState(preview.localCustomerId, {
        syncStatus: "synced",
        lastSyncedAt: new Date(),
        lastError: null,
        lastSyncedEmail: preview.contact.email,
      });
    },
  };
  const customerIdSchema = z.string().trim().min(1).max(200);
  async function guard<T>(
    permission: "read" | "write",
    id: string | undefined,
    operation: () => Promise<T>,
  ) {
    if (!(await host.authorize(permission, id))) throw new BexioApiError("Access denied.", 403);
    return permission === "write" && id ? host.runExclusive(id, operation) : operation();
  }
  const guarded = {
    getLink(id) {
      id = customerIdSchema.parse(id);
      return guard("read", id, () => actions.getLink(id));
    },
    searchContacts(query, type) {
      query = z.string().trim().max(200).parse(query);
      type = bexioContactTypeSchema.parse(type);
      return guard("read", undefined, () => actions.searchContacts(query, type));
    },
    linkContact(id, contactId, type) {
      id = customerIdSchema.parse(id);
      contactId = z.number().int().positive().parse(contactId);
      type = bexioContactTypeSchema.parse(type);
      return guard("write", id, () => actions.linkContact(id, contactId, type));
    },
    createContact(input) {
      input = createAndLinkBexioContactInputSchema.parse(input);
      return guard("write", input.localCustomerId, () => actions.createContact(input));
    },
    unlinkContact(id, type) {
      id = customerIdSchema.parse(id);
      type = bexioContactTypeSchema.parse(type);
      return guard("write", id, () => actions.unlinkContact(id, type));
    },
    syncContact(id) {
      id = customerIdSchema.parse(id);
      return guard("write", id, () => actions.syncContact(id));
    },
    previewImport(id) {
      id = customerIdSchema.parse(id);
      return guard("read", id, () => actions.previewImport(id));
    },
    confirmImport(input) {
      input = confirmBexioImportSchema.parse(input);
      return guard("write", input.localCustomerId, () => actions.confirmImport(input));
    },
  } satisfies BexioContactLinkActions;
  return {
    ...guarded,
    async syncSavedCustomer(id: string): Promise<string | null> {
      try {
        const result = await guarded.syncContact(id);
        return result.status === "error" ? result.message : null;
      } catch {
        return "Customer saved, but Bexio synchronization could not be started. Retry from the customer's Sync tab.";
      }
    },
  };
}

export function createBexioBulkImportService({
  contactClient,
  linkStore,
  customerAdapter,
  customerImportAdapter,
  host,
}: {
  contactClient: BexioBulkContactClient;
  linkStore: BexioContactLinkStore;
  customerAdapter: ForgeCustomerAdapter;
  customerImportAdapter: ForgeCustomerBulkImportAdapter;
  host: BexioHostAdapter;
}) {
  async function importContacts(): Promise<BexioBulkSyncResult> {
    const [contacts, relations, links] = await Promise.all([
      contactClient.listContacts(),
      contactClient.listRelations(),
      linkStore.list(),
    ]);
    const result: BexioBulkSyncResult = {
      total: contacts.length,
      created: 0,
      linked: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      issues: [],
    };
    const byId = new Map(contacts.map((contact) => [contact.id, contact]));
    const people = contacts.filter((contact) => contact.contact_type_id === 2);
    const matches = await customerImportAdapter.findCustomersByEmails(
      people.flatMap((person) =>
        isRealCustomerEmail(normalizeEmail(person.mail)) ? [normalizeEmail(person.mail)] : [],
      ),
    );
    const handledPeople = new Set<number>();
    const handledCompanies = new Set<number>();
    const localLinks = new Map(links.map((link) => [link.localCustomerId, link]));
    const issue = async (id: number, message: string, link?: BexioContactLink, failed = false) => {
      if (link) {
        try {
          await linkStore.updateSyncState(link.localCustomerId, {
            syncStatus: "error",
            lastSyncedAt: link.lastSyncedAt,
            lastError: message,
          });
        } catch {
          // Keep processing other records when persisting one record's failure also fails.
          failed = true;
          message += " The error state could not be saved.";
        }
      }
      result[failed ? "failed" : "skipped"]++;
      if (result.issues.length < 100) result.issues.push({ bexioContactId: id, message });
    };
    const saveLink = async (
      localCustomerId: string,
      person: BexioContact,
      company: BexioContact | null,
    ) => {
      const link = await linkStore.upsert({
        localCustomerId,
        bexioPersonId: person.id,
        bexioCompanyId: company?.id ?? null,
        lastSyncedEmail: normalizeEmail(person.mail),
        syncStatus: "linked",
        lastSyncedAt: null,
        lastError: null,
      });
      localLinks.set(localCustomerId, link);
      handledPeople.add(person.id);
      if (company) handledCompanies.add(company.id);
      try {
        if (company) await contactClient.ensureRelation(company.id, person.id);
        await linkStore.updateSyncState(localCustomerId, {
          syncStatus: "synced",
          lastSyncedAt: new Date(),
          lastError: null,
        });
      } catch (error) {
        await linkStore.updateSyncState(localCustomerId, {
          syncStatus: "error",
          lastSyncedAt: null,
          lastError: getSafeBexioErrorMessage(error),
        });
        throw error;
      }
    };

    // Existing links are authoritative; email is never used to replace a selected person.
    for (const link of links) {
      if (link.bexioPersonId) handledPeople.add(link.bexioPersonId);
      if (link.bexioCompanyId) handledCompanies.add(link.bexioCompanyId);
      try {
        const customer = forgeCustomerSchema.parse(
          await customerAdapter.getCustomer(link.localCustomerId),
        );
        if (customer.localCustomerId !== link.localCustomerId)
          throw new BexioApiError("Customer identity mismatch.");
        const company = link.bexioCompanyId ? byId.get(link.bexioCompanyId) : null;
        let person = link.bexioPersonId ? byId.get(link.bexioPersonId) : undefined;
        if (!link.bexioPersonId && company) {
          const candidates = people.filter(
            (candidate) =>
              normalizeEmail(candidate.mail) === normalizeEmail(customer.email) &&
              relations.some(
                (relation) =>
                  relation.contact_id === company.id && relation.contact_sub_id === candidate.id,
              ),
          );
          if (candidates.length === 1) person = candidates[0];
        }
        if (!person || (link.bexioCompanyId && !company)) {
          await issue(
            link.bexioPersonId ?? link.bexioCompanyId ?? 0,
            "Select a primary contact person or repair the missing Bexio link in the customer's Sync tab.",
            link,
          );
          continue;
        }
        if (
          [...localLinks.values()].some(
            (other) =>
              other.localCustomerId !== link.localCustomerId && other.bexioPersonId === person.id,
          )
        ) {
          await issue(
            person.id,
            "This Bexio person is linked to another customer. Review the contact links.",
            link,
          );
          continue;
        }
        handledPeople.add(person.id);
        const input = importContact(person, company ?? null);
        if (input.email !== normalizeEmail(customer.email)) {
          await issue(person.id, EMAIL_REVIEW, link);
          continue;
        }
        await customerImportAdapter.updateCustomer(customer.localCustomerId, input, customer.email);
        await saveLink(customer.localCustomerId, person, company ?? null);
        result.updated++;
      } catch (error) {
        await issue(
          link.bexioPersonId ?? link.bexioCompanyId ?? 0,
          getSafeBexioErrorMessage(error),
          link,
          true,
        );
      }
    }

    // Import a person and their company as one customer, never a company account plus a person account.
    for (const person of people) {
      if (handledPeople.has(person.id)) continue;
      try {
        const email = normalizeEmail(person.mail);
        const emailMatch = matches.get(email);
        const companyIds = [
          ...new Set(
            relations
              .filter((relation) => relation.contact_sub_id === person.id)
              .map((relation) => relation.contact_id),
          ),
        ];
        if (companyIds.length > 1) {
          await issue(
            person.id,
            "This person belongs to several companies. Select the company manually.",
          );
          continue;
        }
        const company = companyIds[0] ? byId.get(companyIds[0]) : null;
        if (
          company &&
          [...localLinks.values()].some(
            (link) => link.bexioCompanyId === company.id && !link.bexioPersonId,
          )
        ) {
          await issue(
            person.id,
            "An existing customer is linked to this company without a primary person. Complete that customer's link instead of creating a duplicate.",
          );
          continue;
        }
        if (companyIds[0] && !company) {
          await issue(person.id, "The person's company is missing in Bexio.");
          continue;
        }
        if (
          company &&
          relations.filter((relation) => relation.contact_id === company.id).length > 1 &&
          emailMatch?.status !== "customer"
        ) {
          await issue(
            person.id,
            "This company has several contact people. Select the primary person manually.",
          );
          continue;
        }
        if (people.filter((candidate) => normalizeEmail(candidate.mail) === email).length > 1) {
          await issue(
            person.id,
            "Several Bexio people use this email. Select the correct person manually.",
          );
          continue;
        }
        const input = importContact(person, company ?? null);
        if (emailMatch?.status === "conflict") {
          await issue(person.id, emailMatch.message);
          continue;
        }
        if (emailMatch?.status === "customer") {
          const existing = localLinks.get(emailMatch.customer.localCustomerId);
          if (existing) {
            await issue(
              person.id,
              "This customer already has a Bexio link. Review it in the Sync tab.",
            );
            continue;
          }
          await customerImportAdapter.updateCustomer(
            emailMatch.customer.localCustomerId,
            input,
            emailMatch.customer.email,
          );
          await saveLink(emailMatch.customer.localCustomerId, person, company ?? null);
          result.linked++;
        } else {
          const customer = forgeCustomerSchema.parse(
            await customerImportAdapter.createCustomer(input),
          );
          if (normalizeEmail(customer.email) !== input.email)
            throw new BexioApiError("The created customer does not match the imported email.");
          matches.set(input.email, { status: "customer", customer });
          await saveLink(customer.localCustomerId, person, company ?? null);
          result.created++;
        }
      } catch (error) {
        result.failed++;
        if (result.issues.length < 100)
          result.issues.push({
            bexioContactId: person.id,
            message: getSafeBexioErrorMessage(error),
          });
      }
    }
    for (const company of contacts.filter((contact) => contact.contact_type_id === 1)) {
      if (!handledCompanies.has(company.id))
        await issue(
          company.id,
          "Company not imported: link or complete its primary contact person first.",
        );
    }
    return result;
  }
  return {
    async listLinks() {
      if (!(await host.authorize("read"))) throw new BexioApiError("Access denied.", 403);
      return linkStore.list();
    },
    async syncAllContacts() {
      if (!(await host.authorize("write"))) throw new BexioApiError("Access denied.", 403);
      return host.runExclusive(undefined, importContacts);
    },
  } satisfies BexioCustomerDirectoryActions;
}
