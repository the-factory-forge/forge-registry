"use client";
import { useState, useSyncExternalStore } from "react";

import { EmployeeNewPage, EmployeesPage, type Employee } from "@/components/plugins/employees";

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function EmployeesPreview() {
  const creating = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash === "#new",
    () => false,
  );
  const [employees, setEmployees] = useState<Employee[]>([
    {
      id: "admin",
      name: "Alex Morgan",
      email: "alex@example.test",
      role: "admin",
      emailVerified: true,
    },
    {
      id: "user",
      name: "Sam Rivera",
      email: "sam@example.test",
      role: "user",
      emailVerified: false,
    },
  ]);
  const [fail, setFail] = useState(false);
  const [offset, setOffset] = useState(0);
  function beforeAction() {
    if (fail) throw new Error("Preview failure");
  }
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <label className="flex gap-2 text-sm">
        <input type="checkbox" checked={fail} onChange={(event) => setFail(event.target.checked)} />
        Simulate action failure
      </label>
      {creating ? (
        <EmployeeNewPage
          backHref="#"

          onCreate={async ({ password: _password, ...values }) => {
            beforeAction();
            setEmployees((current) => [
              ...current,
              { ...values, id: crypto.randomUUID(), emailVerified: false },
            ]);
            window.location.hash = "";
          }}
        />
      ) : (
        <EmployeesPage
          employees={employees.slice(offset, offset + 25)}
          total={employees.length}
          offset={offset}
          onOffsetChange={setOffset}
          currentUserId="admin"
          createHref="#new"

          onUpdate={async (values) => {
            beforeAction();
            setEmployees((current) =>
              current.map((employee) =>
                employee.id === values.id
                  ? {
                      ...employee,
                      ...values,
                      emailVerified: employee.email === values.email && employee.emailVerified,
                    }
                  : employee,
              ),
            );
          }}
          onDelete={async (id) => {
            beforeAction();
            setEmployees((current) => current.filter((employee) => employee.id !== id));
          }}
          onSetBan={async (id, banned) => {
            beforeAction();
            setEmployees((current) =>
              current.map((employee) => (employee.id === id ? { ...employee, banned } : employee)),
            );
          }}
          onSendVerification={async () => {
            beforeAction();
            return { status: "sent" };
          }}
        />
      )}
    </div>
  );
}
