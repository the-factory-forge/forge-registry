import type {
  BexioContact,
  BexioContactLink,
  BexioContactLinkActions,
  BexioCustomerDirectoryActions,
} from "@/components/connectors/customers-bexio";
import type { Customer } from "@/components/plugins/customers";

/** Browser-only example adapters. Production uses the connector's guarded server service. */
export function createCustomersBexioMock() {
  const customer: Customer = {
    id: "acme",
    name: "Alex Morgan",
    email: "alex@example.com",
    emailVerified: false,
    companyName: "Acme Studio",
    phoneNumber: "+41 79 123 45 67",
  };
  let link: BexioContactLink | null = null;
  let imported = false;
  let fail = false;
  let readOnly = false;
  const contacts: BexioContact[] = [
    {
      id: 101,
      contact_type_id: 2,
      name_1: "Alex Morgan",
      mail: "alex@example.com",
      phone_fixed: "+41 79 765 43 21",
      user_id: 1,
      owner_id: 1,
    },
    { id: 102, contact_type_id: 1, name_1: "Acme Studio", user_id: 1, owner_id: 1 },
    {
      id: 103,
      contact_type_id: 2,
      name_1: "Taylor Reed",
      mail: "taylor@example.com",
      user_id: 1,
      owner_id: 1,
    },
  ];
  async function before(write = false) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (readOnly && write) throw new Error("Access denied.");
    if (fail) throw new Error("Simulated Bexio failure.");
  }
  function attach(id: number, type: "person" | "company") {
    if (
      !contacts.some(
        (contact) => contact.id === id && contact.contact_type_id === (type === "person" ? 2 : 1),
      )
    )
      throw new Error("Contact not found.");
    link = {
      id: "example-link",
      localCustomerId: customer.id,
      bexioPersonId: null,
      bexioCompanyId: null,
      lastSyncedAt: null,
      lastSyncedEmail: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...link,
      [type === "person" ? "bexioPersonId" : "bexioCompanyId"]: id,
      syncStatus: "linked",
      lastError: null,
    };
    return structuredClone(link);
  }
  const actions: BexioContactLinkActions = {
    async getLink() {
      await before();
      return structuredClone(link);
    },
    async searchContacts(query, type) {
      await before();
      return structuredClone(
        contacts.filter(
          (contact) =>
            contact.contact_type_id === (type === "person" ? 2 : 1) &&
            `${contact.name_1} ${contact.mail ?? ""}`.toLowerCase().includes(query.toLowerCase()),
        ),
      );
    },
    async linkContact(_id, id, type) {
      await before(true);
      return attach(id, type);
    },
    async createContact({ contactType }) {
      await before(true);
      if (
        contacts.some((contact) =>
          contactType === "person"
            ? contact.mail === customer.email
            : contact.name_1 === customer.companyName,
        )
      )
        throw new Error("Search and link the matching contact.");
      const id = contacts.length + 101;
      contacts.push({
        id,
        contact_type_id: contactType === "person" ? 2 : 1,
        name_1: contactType === "person" ? customer.name : customer.companyName || "",
        mail: contactType === "person" ? customer.email : null,
        user_id: 1,
        owner_id: 1,
      });
      return attach(id, contactType);
    },
    async unlinkContact(_id, type) {
      await before(true);
      if (!link) return;
      link[type === "person" ? "bexioPersonId" : "bexioCompanyId"] = null;
      link.syncStatus = "linked";
      link.lastError = null;
      if (!link.bexioPersonId && !link.bexioCompanyId) link = null;
    },
    async syncContact() {
      await before(true);
      if (!link) return { status: "not-linked" };
      const person = contacts.find((contact) => contact.id === link?.bexioPersonId);
      if (!person) throw new Error("Link a person first.");
      person.name_1 = customer.name;
      person.mail = customer.email;
      if (customer.phoneNumber) person.phone_fixed = customer.phoneNumber;
      const company = contacts.find((contact) => contact.id === link?.bexioCompanyId);
      if (company && customer.companyName) company.name_1 = customer.companyName;
      link.syncStatus = "synced";
      link.lastSyncedAt = new Date();
      link.lastError = null;
      return { status: "synced", link: structuredClone(link) };
    },
    async previewImport() {
      await before();
      const person = contacts.find((contact) => contact.id === link?.bexioPersonId);
      if (!person?.mail || !link) throw new Error("Link a person first.");
      return {
        localCustomerId: customer.id,
        bexioPersonId: person.id,
        bexioCompanyId: link.bexioCompanyId,
        expectedLocalEmail: customer.email,
        expectedRemoteEmail: person.mail,
        contact: {
          fullName: person.name_1,
          email: person.mail,
          phone: person.phone_fixed ?? null,
          companyName:
            contacts.find((contact) => contact.id === link?.bexioCompanyId)?.name_1 ?? null,
        },
      };
    },
    async confirmImport(expected) {
      await before(true);
      const current = await actions.previewImport(customer.id);
      if (JSON.stringify(current) !== JSON.stringify(expected) || !link)
        throw new Error("Review the import again.");
      Object.assign(customer, {
        name: current.contact.fullName,
        email: current.contact.email,
        phoneNumber: current.contact.phone,
        companyName: current.contact.companyName,
      });
      link.syncStatus = "synced";
      link.lastSyncedAt = new Date();
      link.lastError = null;
      return structuredClone(link);
    },
  };
  const directoryActions: BexioCustomerDirectoryActions = {
    async listLinks() {
      await before();
      return link ? [structuredClone(link)] : [];
    },
    async syncAllContacts(this: void) {
      await before(true);
      const result = {
        total: 3,
        created: imported ? 0 : 1,
        linked: link ? 0 : 1,
        updated: (link ? 1 : 0) + (imported ? 1 : 0),
        skipped: 0,
        failed: 0,
        issues: [],
      };
      attach(101, "person");
      attach(102, "company");
      Object.assign(customer, { name: contacts[0].name_1, phoneNumber: contacts[0].phone_fixed });
      if (link) {
        link.syncStatus = "synced";
        link.lastSyncedAt = new Date();
      }
      imported = true;
      return result;
    },
  };
  return {
    customer,
    actions,
    directoryActions,
    async syncSavedCustomer() {
      try {
        const result = await actions.syncContact(customer.id);
        return result.status === "error" ? result.message : null;
      } catch {
        return "Customer saved, but Bexio synchronization failed. Retry from Sync.";
      }
    },
    configure(options: { fail: boolean; readOnly: boolean }) {
      fail = options.fail;
      readOnly = options.readOnly;
    },
  };
}
