## Context

Drive owns a Base UI toast provider per browser. The reusable renderer lives in
`registry/components/plugins/drive/ui.tsx`; downloads and Undo are initiated by
`index.tsx`. The upload queue already tracks independent progress and recovery.

## Decisions

Use the installed promise manager for the complete download-start operation,
including signed-URL validation. Its loading toast updates to success or a
persistent error. The existing download lock still prevents duplicate requests.

Undo updates its existing confirmation toast in place so retry and Trash conflict
actions retain their context. Upload batches derive the same states from their
queue rather than adding artificial promises. Keep their progress and recovery
controls, timeout and dismissal behavior. A shared header centers status, text
and actions; upload details follow below. Spinner motion uses reduced-motion-safe CSS.

Rebuild the existing Drive registry endpoint. Preserve the source distribution,
portable UI and semantic theme decisions in
[ADR-0001](https://github.com/the-factory-forge/forge-spec/blob/main/concepts/adr/repository-ownership-and-source-distribution.md),
[ADR-0002](https://github.com/the-factory-forge/forge-spec/blob/main/concepts/adr/portable-ui-and-host-adapters.md) and
[ADR-0006](https://github.com/the-factory-forge/forge-spec/blob/main/concepts/adr/semantic-themes-and-explicit-consumer-styles.md).

## Risks / Trade-offs

Download success means the browser download was started; its transfer completion
belongs to the browser. Upload cancellation remains distinct in each file's status.
