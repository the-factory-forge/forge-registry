import type { Customer, CustomerFormValues } from "@/components/plugins/customers/types";

export function customerDisplayName(customer: Pick<Customer, "name" | "companyName">) {
  return customer.companyName?.trim() || customer.name;
}

export function customerInitials(name: string, email: string) {
  return name.trim()
    ? name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()
    : email.trim().slice(0, 2).toUpperCase() || "?";
}

export function customerFormValues(customer?: Customer): CustomerFormValues {
  return {
    name: customer?.name ?? "",
    email: customer?.email ?? "",
    phoneNumber: customer?.phoneNumber ?? "",
    companyName: customer?.companyName ?? "",
    street: customer?.street ?? "",
    city: customer?.city ?? "",
    addressComplement: customer?.addressComplement ?? "",
  };
}
