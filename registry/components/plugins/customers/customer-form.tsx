"use client";

import { Input } from "@base-ui/react/input";
import { CopyIcon, DicesIcon } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import type { CustomersLabels } from "@/components/plugins/customers/labels";
import type {
  Customer,
  CustomerCreateValues,
  CustomerFormValues,
} from "@/components/plugins/customers/types";
import {
  buttonClass,
  cardClass,
  Feedback,
  inputClass,
  primaryButtonClass,
  useCustomerAction,
} from "@/components/plugins/customers/ui";
import { customerFormValues, generateCustomerPassword } from "@/components/plugins/customers/utils";
import { cn } from "@/components/utils/cn";

export interface CustomerFormProps {
  customer?: Customer;
  labels: CustomersLabels;
  onSubmit: (values: CustomerCreateValues) => Promise<void>;
  emailChangeDescription?: string;
  passwordMinLength?: number;
  passwordMaxLength?: number;
}

export function CustomerForm({
  customer,
  labels,
  onSubmit,
  emailChangeDescription,
  passwordMinLength = 12,
  passwordMaxLength = 128,
}: CustomerFormProps) {
  const id = useId();
  const creating = !customer;
  const [values, setValues] = useState(() => customerFormValues(customer));
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerCreateValues, string>>>({});
  const [passwordFeedback, setPasswordFeedback] = useState<{ error: boolean; message: string }>();
  const action = useCustomerAction(labels.actionError);

  async function copyPassword(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setPasswordFeedback({ error: false, message: labels.passwordCopied });
    } catch {
      setPasswordFeedback({ error: true, message: labels.passwordCopyError });
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action.pending) return;
    const form = event.currentTarget;
    const nextErrors: typeof errors = {};
    if (!values.name.trim()) nextErrors.name = labels.nameRequired;
    const emailInput = form.elements.namedItem("email") as HTMLInputElement;
    if (((!creating || password) && !values.email.trim()) || emailInput.validity.typeMismatch)
      nextErrors.email = labels.emailRequired;
    if (
      creating &&
      password &&
      (password.length < passwordMinLength || password.length > passwordMaxLength)
    )
      nextErrors.password = labels.passwordInvalid(passwordMinLength, passwordMaxLength);
    setErrors(nextErrors);
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      (form.elements.namedItem(firstInvalid) as HTMLInputElement)?.focus();
      return;
    }
    const normalized: CustomerFormValues = {
      ...values,
      name: values.name.trim(),
      email: values.email.trim(),
    };
    const data = creating && password ? { ...normalized, password } : normalized;
    if (await action.run(() => onSubmit(data), creating ? labels.created : labels.saved)) {
      setValues(normalized);
      setPassword("");
      setPasswordFeedback(undefined);
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
            setErrors({ ...errors, [name]: undefined });
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
          <p id={errorId} role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form noValidate onSubmit={submit} aria-busy={action.pending} className="space-y-6">
      <fieldset disabled={action.pending} className="min-w-0 space-y-6">
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
              required: !creating || Boolean(password),
              description: creating ? undefined : emailChangeDescription,
            })}
            {creating && (
              <div className="space-y-2">
                <label htmlFor={`${id}-password`} className="block text-sm font-semibold">
                  {labels.password}
                </label>
                <div className="relative">
                  <Input
                    id={`${id}-password`}
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    minLength={passwordMinLength}
                    maxLength={passwordMaxLength}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setErrors({ ...errors, password: undefined });
                      setPasswordFeedback(undefined);
                    }}
                    className={cn(inputClass, "pl-20")}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={`${id}-password-description${errors.password ? ` ${id}-password-error` : ""}`}
                  />
                  <div className="absolute inset-y-0 left-1 flex items-center">
                    <button
                      type="button"
                      className={cn(buttonClass, "px-2")}
                      aria-label={labels.generatePassword}
                      onClick={() => {
                        try {
                          const generated = generateCustomerPassword(
                            passwordMinLength,
                            passwordMaxLength,
                          );
                          setPassword(generated);
                          setErrors({ ...errors, password: undefined });
                          void copyPassword(generated);
                        } catch {
                          setPasswordFeedback({
                            error: true,
                            message: labels.passwordGenerateError,
                          });
                        }
                      }}
                    >
                      <DicesIcon aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={cn(buttonClass, "px-2")}
                      disabled={!password}
                      aria-label={labels.copyPassword}
                      onClick={() => void copyPassword(password)}
                    >
                      <CopyIcon aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <p id={`${id}-password-description`} className="text-sm text-muted-foreground">
                  {labels.passwordDescription(passwordMinLength, passwordMaxLength)}
                </p>
                {errors.password && (
                  <p
                    id={`${id}-password-error`}
                    role="alert"
                    className="text-sm text-red-600 dark:text-red-400"
                  >
                    {errors.password}
                  </p>
                )}
                <Feedback feedback={passwordFeedback} />
              </div>
            )}
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
        <div className="flex justify-end">
          <button type="submit" className={primaryButtonClass}>
            {action.pending ? labels.pending : creating ? labels.create : labels.save}
          </button>
        </div>
      </fieldset>
      <Feedback feedback={action.feedback} />
    </form>
  );
}
