import type { ComponentType, ReactNode } from "react";

import type { LinkProps } from "@/components/link";
import type { CustomersLabels } from "@/components/plugins/customers/labels";
import type { TableSort, TableSortProps } from "@/components/utils/table-sort-state";

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

export type CustomerCreateValues = CustomerFormValues;

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

export const CUSTOMER_SORT_FIELDS = ["name", "email", "status", "sync"] as const;
export type CustomerSortField = (typeof CUSTOMER_SORT_FIELDS)[number];
export const customerDefaultSort = {
  field: "name",
  direction: "asc",
} as const satisfies TableSort<CustomerSortField>;

export interface CustomersPageProps
  extends TableSortProps<CustomerSortField>, CustomersAppearanceProps {
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
  syncColumn?: {
    label: string;
    render: (customer: Customer) => ReactNode;
    sortValue?: (customer: Customer) => string | number | null;
  };
}

export interface CustomerDetailPageProps extends CustomersAppearanceProps {
  customer: Customer;
  section?: CustomerSection;
  backHref: string;
  sectionHrefs: Record<Exclude<CustomerSection, "sync">, string> & { sync?: string };
  onSave: (values: CustomerFormValues) => Promise<void>;
  onDelete?: (customerId: string) => Promise<void>;
  onSetVerified?: (customerId: string, verified: boolean) => Promise<void>;
  emailChangeDescription?: string;
  projectsContent?: ReactNode;
  syncContent?: ReactNode;
}

export type CustomerDetailPageLoadingProps = Pick<
  CustomerDetailPageProps,
  | "className"
  | "labels"
  | "linkComponent"
  | "section"
  | "backHref"
  | "sectionHrefs"
  | "emailChangeDescription"
> & { customer: null };

export interface CustomerNewPageProps extends CustomersAppearanceProps {
  backHref: string;
  onCreate: (values: CustomerCreateValues) => Promise<void>;
}
