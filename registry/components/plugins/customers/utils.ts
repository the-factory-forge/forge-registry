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

// Web Crypto is accessed only when the user requests a password.
export function generateCustomerPassword(min = 12, max = 128) {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > 1024) {
    throw new RangeError("Password limits must be integers within 1–1024.");
  }
  const groups = [
    "abcdefghijkmnopqrstuvwxyz",
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "23456789",
    "!@#$%^&*()-_=+",
  ];
  const alphabet = groups.join("");
  function randomIndex(length: number) {
    const limit = Math.floor(0x1_0000_0000 / length) * length;
    const random = new Uint32Array(1);
    do {
      crypto.getRandomValues(random);
    } while (random[0] >= limit);
    return random[0] % length;
  }
  const length = Math.min(max, Math.max(20, min));
  const characters = groups.slice(0, length).map((group) => group[randomIndex(group.length)]);
  while (characters.length < length) characters.push(alphabet[randomIndex(alphabet.length)]);
  for (let index = characters.length - 1; index > 0; index--) {
    const other = randomIndex(index + 1);
    [characters[index], characters[other]] = [characters[other], characters[index]];
  }
  return characters.join("");
}
