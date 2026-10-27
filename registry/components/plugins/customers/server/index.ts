export {
  createCustomersSchema,
  type CustomersSchema,
  type CustomerProfile,
  type CustomerUserTable,
} from "@/components/plugins/customers/server/schema";
export {
  createCustomersService,
  customerInputSchema,
  CustomersError,
  type CustomersAction,
  type CustomersServiceOptions,
  type CustomerAuthApi,
} from "@/components/plugins/customers/server/service.server";
