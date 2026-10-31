import { z } from "zod";

import {
  bexioContactSchema,
  bexioRelationSchema,
  bexioUserSchema,
  createBexioContactInputSchema,
  forgeCustomerSchema,
  bexioContactTypeSchema,
  isRealCustomerEmail,
  type BexioBulkContactClient,
  type BexioContactType,
  type BexioCredentialProvider,
  type CreateBexioContactInput,
  type ForgeCustomer,
} from "@/components/connectors/customers-bexio/contracts";

const BEXIO_API_URL = "https://api.bexio.com";
const REQUEST_TIMEOUT_MS = 10_000;
const CONTACT_PAGE_SIZE = 500;

export class BexioApiError extends Error {
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;

  constructor(
    message: string,
    status: number | null = null,
    retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "BexioApiError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function errorMessageForStatus(status: number, retryAfterSeconds: number | null) {
  if (status === 401) {
    return "Bexio authentication failed. Renew the connection credentials.";
  }
  if (status === 403) {
    return "The Bexio token does not have permission to manage contacts.";
  }
  if (status === 422) {
    return "Bexio rejected the contact data.";
  }
  if (status === 429) {
    return retryAfterSeconds
      ? `Bexio rate limit reached. Retry in ${retryAfterSeconds} seconds.`
      : "Bexio rate limit reached. Retry shortly.";
  }
  return `Bexio request failed with status ${status}.`;
}

export function getSafeBexioErrorMessage(error: unknown) {
  if (error instanceof BexioApiError) return error.message.slice(0, 500);
  return "Bexio could not be reached. Retry the synchronization later.";
}

function getContactTypeId(contactType: BexioContactType) {
  return contactType === "company" ? 1 : 2;
}

function getContactNames(input: CreateBexioContactInput) {
  if (input.contactType === "company") {
    if (!input.companyName) {
      throw new BexioApiError("Company name is required for a Bexio company contact.");
    }
    return { name_1: input.companyName, name_2: null };
  }

  if (!input.fullName || !input.email || !isRealCustomerEmail(input.email)) {
    throw new BexioApiError("A full name and real email are required for a Bexio person contact.");
  }
  // Bexio requires name_1; keep the full name intact instead of guessing name parts.
  return { name_1: input.fullName, name_2: null };
}

export function createBexioContactClient({
  credentialProvider,
  request = fetch,
}: {
  credentialProvider: BexioCredentialProvider;
  request?: typeof fetch;
}): BexioBulkContactClient {
  async function requestJson<TSchema extends z.ZodType>(
    path: string,
    schema: TSchema,
    init?: RequestInit,
  ): Promise<z.infer<TSchema>> {
    const accessToken = z.string().parse(await credentialProvider.getAccessToken());
    if (!accessToken.trim()) {
      throw new BexioApiError("Bexio credentials are not configured.");
    }

    let response: Response;
    try {
      response = await request(new URL(path, BEXIO_API_URL), {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new BexioApiError("Bexio could not be reached. Retry the synchronization later.");
    }

    if (!response.ok) {
      const rateLimitReset = response.headers.get("RateLimit-Reset");
      const parsedReset = rateLimitReset ? Number.parseInt(rateLimitReset, 10) : Number.NaN;
      const retryAfterSeconds = Number.isFinite(parsedReset) ? parsedReset : null;
      throw new BexioApiError(
        errorMessageForStatus(response.status, retryAfterSeconds),
        response.status,
        retryAfterSeconds,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new BexioApiError("Bexio returned an unreadable response.");
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new BexioApiError("Bexio returned an unexpected response.", response.status);
    }
    return parsed.data;
  }

  async function getContact(contactId: number) {
    contactId = z.number().int().positive().parse(contactId);
    return requestJson(`/2.0/contact/${contactId}`, bexioContactSchema);
  }

  async function listPages<TSchema extends z.ZodType>(path: string, schema: TSchema) {
    const rows: z.infer<TSchema>[] = [];
    for (let offset = 0; ; offset += CONTACT_PAGE_SIZE) {
      const page = await requestJson(
        `${path}?limit=${CONTACT_PAGE_SIZE}&offset=${offset}&order_by=id`,
        z.array(schema),
      );
      rows.push(...page);
      if (page.length < CONTACT_PAGE_SIZE) return rows;
    }
  }

  async function getContactAddress(input: CreateBexioContactInput | ForgeCustomer) {
    const street = input.street?.trim();
    const addressComplement = input.addressComplement?.trim();
    const postalCode = input.postalCode?.trim();
    const city = input.city?.trim();
    const countryCode = input.countryCode?.trim().toUpperCase();
    let countryId: number | null = null;
    if (countryCode) {
      const countries = await listPages(
        "/2.0/country",
        z.object({
          id: z.number().int().positive(),
          name_short: z.string().nullable().optional(),
          iso3166_alpha2: z.string().nullable().optional(),
        }),
      );
      countryId =
        countries.find(
          (country) =>
            country.iso3166_alpha2?.toUpperCase() === countryCode ||
            country.name_short?.toUpperCase() === countryCode,
        )?.id ?? null;
      if (!countryId) throw new BexioApiError(`Country ${countryCode} was not found in Bexio.`);
    }
    return {
      ...(street ? { street_name: street } : {}),
      ...(street && addressComplement ? { address_addition: addressComplement } : {}),
      ...(postalCode ? { postcode: postalCode } : {}),
      ...(city ? { city } : {}),
      ...(countryId ? { country_id: countryId } : {}),
    };
  }

  async function getLanguageId(language: ForgeCustomer["language"]) {
    const languages = await listPages(
      "/2.0/language",
      z.object({ id: z.number().int().positive(), iso_639_1: z.string() }),
    );
    const languageId = languages.find((entry) => entry.iso_639_1 === language)?.id;
    if (!languageId) throw new BexioApiError(`Language ${language} was not found in Bexio.`);
    return languageId;
  }

  return {
    listContacts: () => listPages("/2.0/contact", bexioContactSchema),
    listRelations: () => listPages("/2.0/contact_relation", bexioRelationSchema),
    async searchContacts(query, contactType, exact = false) {
      const normalizedQuery = z.string().trim().max(200).parse(query);
      contactType = bexioContactTypeSchema.parse(contactType);
      if (!normalizedQuery) return [];

      const isEmail = z.email().safeParse(normalizedQuery).success;
      if (isEmail && !isRealCustomerEmail(normalizedQuery)) return [];
      return requestJson(
        "/2.0/contact/search?limit=20&order_by=name_1",
        z.array(bexioContactSchema),
        {
          method: "POST",
          body: JSON.stringify([
            {
              field: isEmail ? "mail" : "name_1",
              value: normalizedQuery,
              criteria: isEmail || exact ? "=" : "like",
            },
            {
              field: "contact_type_id",
              value: String(getContactTypeId(contactType)),
              criteria: "=",
            },
          ]),
        },
      );
    },

    getContact,

    async ensureRelation(companyId, personId) {
      companyId = z.number().int().positive().parse(companyId);
      personId = z.number().int().positive().parse(personId);
      const findRelation = () =>
        requestJson("/2.0/contact_relation/search", z.array(bexioRelationSchema), {
          method: "POST",
          body: JSON.stringify([
            { field: "contact_id", value: String(companyId), criteria: "=" },
            { field: "contact_sub_id", value: String(personId), criteria: "=" },
          ]),
        });
      if ((await findRelation()).length) return;
      // Bexio's documented creation response is inconsistent; verify the stored pair instead.
      await requestJson("/2.0/contact_relation", z.unknown(), {
        method: "POST",
        body: JSON.stringify({
          contact_id: companyId,
          contact_sub_id: personId,
          description: "Contact person",
        }),
      });
      if (!(await findRelation()).length)
        throw new BexioApiError(
          "The Bexio contact relationship could not be verified. Retry synchronization.",
        );
    },

    async getAuthenticatedUser() {
      return requestJson("/3.0/users/me", bexioUserSchema);
    },

    async createContact(input) {
      const validatedInput = createBexioContactInputSchema.parse(input);
      const names = getContactNames(validatedInput);
      const address = await getContactAddress(validatedInput);
      const languageId = await getLanguageId(validatedInput.language);
      return requestJson("/2.0/contact", bexioContactSchema, {
        method: "POST",
        body: JSON.stringify({
          contact_type_id: getContactTypeId(validatedInput.contactType),
          ...names,
          ...address,
          language_id: languageId,
          ...(validatedInput.contactType === "person"
            ? { mail: validatedInput.email, phone_fixed: validatedInput.phone }
            : {}),
          user_id: validatedInput.ownerId,
          owner_id: validatedInput.ownerId,
        }),
      });
    },

    async updateContact(contactId, customer, contactType) {
      customer = forgeCustomerSchema.parse(customer);
      contactType = bexioContactTypeSchema.parse(contactType);
      const currentContact = await getContact(contactId);
      const currentContactType = currentContact.contact_type_id === 1 ? "company" : "person";
      if (currentContactType !== contactType) {
        throw new BexioApiError(
          "The Bexio contact type changed. Unlink and relink the contact before synchronizing.",
        );
      }
      const companyName = customer.companyName?.trim();
      const phone = customer.phone?.trim();
      if (
        contactType === "person" &&
        (!customer.fullName.trim() || !isRealCustomerEmail(customer.email))
      ) {
        throw new BexioApiError(
          "Complete the contact person's full name and real email before synchronizing.",
        );
      }
      const address =
        contactType === "company" || !companyName ? await getContactAddress(customer) : {};
      const languageId = await getLanguageId(customer.language);

      return requestJson(`/2.0/contact/${contactId}`, bexioContactSchema, {
        method: "POST",
        body: JSON.stringify({
          contact_type_id: currentContact.contact_type_id,
          name_1:
            contactType === "company" ? companyName || currentContact.name_1 : customer.fullName,
          name_2: contactType === "company" ? (currentContact.name_2 ?? null) : null,
          ...address,
          language_id: languageId,
          ...(contactType === "person"
            ? { mail: customer.email, phone_fixed: phone || currentContact.phone_fixed || null }
            : {}),
          user_id: currentContact.user_id,
          owner_id: currentContact.owner_id,
        }),
      });
    },
  };
}
