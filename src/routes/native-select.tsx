import { createFileRoute } from "@tanstack/react-router";
import { useId, useState } from "react";

import { NativeSelect } from "@/components/native-select";
import { showroomHead } from "@/showroom/seo";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

const fieldClass =
  "min-h-10 rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground disabled:opacity-50 md:text-sm";

function NativeSelectExample() {
  const id = `factory-native-select-${useId()}`;
  const [value, setValue] = useState("ready");
  return (
    <ShowroomPreview width="narrow">
      <ShowroomIntro title="Native select">
        Choose an option with the mouse or keyboard. The arrow stays inset from the border, with
        room for long labels in either theme.
      </ShowroomIntro>
      <div className="max-w-sm space-y-6">
        <label htmlFor={id} className="block space-y-2">
          <span>Directory state</span>
          <NativeSelect
            id={id}
            name="state"
            className={fieldClass}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          >
            <option value="ready">Ready</option>
            <option value="loading">Loading</option>
            <option value="unavailable">Current owner unavailable for this project</option>
          </NativeSelect>
        </label>
        <label htmlFor={`${id}-disabled`} className="block space-y-2">
          <span>Unavailable directory</span>
          <NativeSelect
            id={`${id}-disabled`}
            className={fieldClass}
            disabled
            defaultValue="loading"
          >
            <option value="loading">Loading</option>
          </NativeSelect>
        </label>
        <output className="block text-sm text-muted-foreground">Selected value: {value}</output>
      </div>
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/native-select")({
  head: ({ match }) =>
    showroomHead({
      title: "React native select demo",
      description:
        "Try consistent dropdown arrow spacing, native keyboard selection, and disabled states.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: NativeSelectExample,
});
