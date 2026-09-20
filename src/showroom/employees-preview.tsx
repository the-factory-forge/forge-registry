"use client";
import { useState } from "react";

import { EmployeesPage, type Employee } from "@/components/plugins/employees";
import { ShowroomPreview } from "@/showroom/showroom-preview";

export function EmployeesPreview() {
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
  const [role, setRole] = useState("admin");
  const [offset, setOffset] = useState(0);
  function beforeAction() {
    if (fail) throw new Error("Preview failure");
  }
  return (
    <ShowroomPreview
      controls={
        <>
          <label className="flex items-center gap-2 text-sm">
            Preview as
            <select
              className="rounded border bg-background p-2"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="admin">Administrator</option>
              <option value="user">Employee</option>
              <option value="">No role</option>
            </select>
          </label>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={fail}
              onChange={(event) => setFail(event.target.checked)}
            />
            Simulate action failure
          </label>
        </>
      }
    >
      {role !== "admin" && (
        <output>The employees dashboard is available to administrators only.</output>
      )}
      <EmployeesPage
        employees={employees.slice(offset, offset + 25)}
        total={employees.length}
        offset={offset}
        onOffsetChange={setOffset}
        currentUserId="admin"
        currentUserRole={role}
        onCreate={async ({ password: _password, ...values }) => {
          beforeAction();
          setEmployees((current) => [
            ...current,
            { ...values, id: crypto.randomUUID(), emailVerified: false },
          ]);
        }}
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
        onSendVerification={async () => {
          beforeAction();
          return { status: "sent" };
        }}
      />
    </ShowroomPreview>
  );
}
