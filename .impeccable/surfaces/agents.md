# Agents workspace

Approved structure: dedicated intranet page; select an operation before chat;
private saved conversations; direct authorized reads; one approval for each
mutation; attachments and existing crops; host-supplied model runtime; seven
plugin integrations and optional host-defined interactive workflows.

Mode: Operate. Build path: code. This surface extends the existing intranet
visual system recorded in PRODUCT.md and DESIGN.md. It introduces no palette,
font, motion system, image assets or global CSS changes. The user's accepted
implementation plan fixes the composition; there is no new visual-world or comp
round to approve.

THESIS: Select a bounded operation, discuss its records, then inspect and approve
one concrete change at a time.

OWN-WORLD: Existing Forge semantic surfaces, compact controls, Lucide action
icons, neutral borders, readable type and explicit permission/recovery states.

STORY: Operation selection → private conversation → message and attachment →
read result or proposed change → approval/rejection → durable result.

FIRST VIEWPORT: Agents title and selected operation, conversation history and
new-chat action, transcript and composer. Narrow screens stack history above
chat. The initial empty state offers operation cards with titles and descriptions;
a selected operation enables the composer. The first Send creates the chat;
New conversation opens an unsaved draft without an intermediate Start button. The cards remain visible in new
empty chats until the first message, with the current operation marked as selected.

FORM: A history rail and flexible main conversation on desktop; stacked on
mobile. Proposal cards show the target, before/after values, final attachment,
side effects and individual actions. Errors stay with their recovery controls.
The composer stays available below a bounded scrolling transcript. Chat titles
carry their plugin icon; the operation selector locks after the first message, with
All operations returning to the chooser. Without an operation filter, the
history rail combines accessible plugin conversations with their icons, most
recent first; opening a chat restores its saved operation. Completed actions expose a translated
link icon when the host provides the record destination.

Quality evidence: desktop/mobile in both themes, keyboard-accessible operation
and approval controls, no horizontal overflow, file crop and final preview,
reload/Back/Forward, rejection, failure retry, Stop and confirmed deletion.
The showroom uses deterministic browser-session mocks, never production data.

Preserve the existing DESIGN.md and sidecar. The sidecar's pre-existing drift is
outside this feature and must not be repaired as part of the addition.
