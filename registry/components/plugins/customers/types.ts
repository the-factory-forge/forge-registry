import type { ComponentType, ReactNode } from "react";

import type { LinkProps } from "@/components/link";
import type { CustomersLabels } from "@/components/plugins/customers/labels";

export type CustomerSection = "about" | "projects" | "sync";

export interface CustomerFormValues {
  name: string;
  email: string;
  phoneNumber: string;
  companyName: string;
  street: string;
  city: string;
  addressComplement: string;
}

export interface CustomerCreateValues extends CustomerFormValues {
  password?: string;
}

export interface Customer extends Pick<CustomerFormValues, "name" | "email"> {
  id: string;
  emailVerified: boolean;
  image?: string | null;
  banned?: boolean | null;
  companyName?: string | null;
  phoneNumber?: string | null;
  street?: string | null;
  city?: string | null;
  addressComplement?: string | null;
}

export interface CustomersAppearanceProps {
  className?: string;
  labels?: Partial<CustomersLabels>;
  linkComponent?: ComponentType<LinkProps>;
}

export interface CustomersPageProps extends CustomersAppearanceProps {
  customers: readonly Customer[];
  search: string;
  onSearchChange: (search: string) => void;
  loading?: boolean;
  error?: string;
  createHref: string;
  getCustomerHref: (customer: Customer, section: CustomerSection) => string;
  onDelete?: (customerId: string) => Promise<void>;
  onSetVerified?: (customerId: string, verified: boolean) => Promise<void>;
  onImpersonate?: (customerId: string) => Promise<void>;
  toolbar?: ReactNode;
  syncColumn?: { label: string; render: (customer: Customer) => ReactNode };
}

export interface CustomerDetailPageProps extends CustomersAppearanceProps {
  customer: Customer;
  section?: CustomerSection;
  backHref: string;
  sectionHrefs: Record<CustomerSection, string>;
  onSave: (values: CustomerFormValues) => Promise<void>;
  onDelete?: (customerId: string) => Promise<void>;
  emailChangeDescription?: string;
  projectsContent?: ReactNode;
  syncContent?: ReactNode;
}

export interface CustomerNewPageProps extends CustomersAppearanceProps {
  backHref: string;
  onCreate: (values: CustomerCreateValues) => Promise<void>;
  passwordMinLength?: number;
  passwordMaxLength?: number;
}
