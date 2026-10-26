"use client";

import { Input } from "@base-ui/react/input";
import { useId, useState, type FormEvent } from "react";

import { ActionToastProvider } from "@/components/action-toast";
import type { CustomersLabels } from "@/components/plugins/customers/labels";
import type {
  Customer,
  CustomerCreateValues,
  CustomerFormValues,
} from "@/components/plugins/customers/types";
import {
  cardClass,
  CustomerAvatar,
  Feedback,
  inputClass,
  primaryButtonClass,
  useCustomerAction,
} from "@/components/plugins/customers/ui";
import { customerDisplayName, customerFormValues } from "@/components/plugins/customers/utils";
import { RecordDeleteButton, useRecordDeletion } from "@/components/record-deletion";
import { cn } from "@/components/utils/cn";
import { editorActionsClass, useEditorValidation } from "@/components/utils/editor-form";

export interface CustomerFormProps {
  customer?: Customer;
  disabled?: boolean;
  labels: CustomersLabels;
  onSubmit: (values: CustomerCreateValues) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  emailChangeDescription?: string;
}

function CustomerFormContent({
  customer,
  disabled,
  labels,
  onSubmit,
  onDelete,
  emailChangeDescription,
}: CustomerFormProps) {
  const id = `factory-customer-form-${useId()}`;
  const creating = !customer;
  const [values, setValues] = useState(() => customerFormValues(customer));
  const { formRef, issues: errors, setIssues: setErrors, clear } = useEditorValidation();
  const action = useCustomerAction(labels.actionError);
  const deletion = useRecordDeletion({
    items: customer ? [customer] : [],
    scope: customer?.id,
    getName: customerDisplayName,
    onDelete,
    label: labels.deleteCustomer,
    labels,
    disabled: disabled || action.pending,
    returnFocus: formRef,
    className: "max-w-md",
  });
  const pending = disabled || action.pending || deletion.pending;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const nextErrors: typeof errors = {};
    if (!values.name.trim()) nextErrors.name = labels.nameRequired;
    const emailInput = form.elements.namedItem("email") as HTMLInputElement;
    if (!values.email.trim() || emailInput.validity.typeMismatch)
      nextErrors.email = labels.emailRequired;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const normalized: CustomerFormValues = {
      ...values,
      name: values.name.trim(),
      email: values.email.trim(),
    };
    if (await action.run(() => onSubmit(normalized), creating ? labels.created : labels.saved)) {
      setValues(normalized);
    }
  }

  function field(
    name: keyof CustomerFormValues,
    options: {
      type?: string;
      autoComplete?: string;
      placeholder?: string;
      required?: boolean;
      full?: boolean;
      description?: string;
    } = {},
  ) {
    const error = errors[name];
    const descriptionId = `${id}-${name}-description`;
    const errorId = `${id}-${name}-error`;
    return (
      <div className={cn("space-y-2", options.full && "md:col-span-2")}>
        <label htmlFor={`${id}-${name}`} className="block text-sm font-semibold">
          {labels[name]}
          {options.required && " *"}
        </label>
        <Input
          id={`${id}-${name}`}
          name={name}
          type={options.type ?? "text"}
          autoComplete={options.autoComplete}
          placeholder={options.placeholder}
          required={options.required}
          value={values[name]}
          onChange={(event) => {
            setValues({ ...values, [name]: event.target.value });
            clear(name);
          }}
          className={inputClass}
          aria-invalid={Boolean(error)}
          aria-describedby={
            [options.description ? descriptionId : "", error ? errorId : ""]
              .filter(Boolean)
              .join(" ") || undefined
          }
        />
        {options.description && (
          <p id={descriptionId} className="text-sm text-muted-foreground">
            {options.description}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      tabIndex={-1}
      noValidate
      onSubmit={submit}
      aria-busy={pending}
      className="space-y-6 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {creating && (
        <header className={cn(cardClass, "flex items-center gap-4")}>
          <CustomerAvatar customer={values} large />
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-base font-semibold">{labels.newTitle}</h1>
            <p className="text-sm text-muted-foreground">{labels.newDescription}</p>
          </div>
        </header>
      )}
      <fieldset disabled={pending} className="min-w-0 space-y-6">
        <section aria-labelledby={`${id}-contact`} className={cn(cardClass, "space-y-5")}>
          <div className="space-y-1.5">
            <h2 id={`${id}-contact`} className="font-semibold">
              {labels.contactTitle}
            </h2>
            <p className="text-sm text-muted-foreground">{labels.contactDescription}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {field("name", { required: true, autoComplete: "name" })}
            {field("email", {
              type: "email",
              autoComplete: "email",
              required: true,
              description: creating ? undefined : emailChangeDescription,
            })}
            {field("phoneNumber", {
              type: "tel",
              autoComplete: "tel",
              placeholder: labels.phonePlaceholder,
            })}
          </div>
        </section>
        <section aria-labelledby={`${id}-company`} className={cn(cardClass, "space-y-5")}>
          <div className="space-y-1.5">
            <h2 id={`${id}-company`} className="font-semibold">
              {labels.companyTitle}
            </h2>
            <p className="text-sm text-muted-foreground">{labels.companyDescription}</p>
          </div>
          {field("companyName", { autoComplete: "organization" })}
        </section>
        <section aria-labelledby={`${id}-billing`} className={cn(cardClass, "space-y-5")}>
          <h2 id={`${id}-billing`} className="font-semibold">
            {labels.billingTitle}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {field("street", {
              full: true,
              autoComplete: "address-line1",
              placeholder: labels.streetPlaceholder,
            })}
            {field("city", { autoComplete: "address-level2", placeholder: labels.cityPlaceholder })}
            {field("addressComplement", {
              autoComplete: "address-line2",
              placeholder: labels.addressPlaceholder,
            })}
          </div>
        </section>
      </fieldset>
      <div className={editorActionsClass}>
        {customer && onDelete && (
          <RecordDeleteButton
            label={labels.deleteCustomer}
            disabled={pending}
            onClick={(event) => deletion.open(customer.id, event.currentTarget)}
          />
        )}
        <button type="submit" disabled={pending} className={cn(primaryButtonClass, "ml-auto")}>
          {pending ? labels.pending : creating ? labels.create : labels.save}
        </button>
      </div>
      <Feedback feedback={action.feedback} />
      {deletion.dialog}
    </form>
  );
}

export function CustomerForm(props: CustomerFormProps) {
  return (
    <ActionToastProvider>
      <CustomerFormContent {...props} />
    </ActionToastProvider>
  );
}
