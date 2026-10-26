---
name: Forge Registry
description: Existing showroom and reusable UI conventions
colors:
  background: "light-dark(#ffffff, #000000)"
  foreground: "light-dark(#000000, #ffffff)"
  primary: "light-dark(#13343a, #badede)"
  primary-foreground: "light-dark(#ffffff, #13343a)"
  muted-foreground: "light-dark(rgb(0 0 0 / 62%), rgb(255 255 255 / 68%))"
  border: "light-dark(rgb(0 0 0 / 18%), rgb(255 255 255 / 18%))"
  input: "light-dark(rgb(0 0 0 / 28%), rgb(255 255 255 / 28%))"
  destructive: "light-dark(oklch(0.58 0.22 27), oklch(0.704 0.191 22.216))"
  destructive-foreground: "light-dark(#ffffff, #000000)"
  status-success: "light-dark(#dcfce7, #052e16)"
  status-success-foreground: "light-dark(#166534, #86efac)"
  status-pending: "light-dark(#ffedd5, #431407)"
  status-pending-foreground: "light-dark(#9a3412, #fdba74)"
  status-not-started: "light-dark(#f3f4f6, #1f2937)"
  status-not-started-foreground: "light-dark(#4b5563, #d1d5db)"
  status-canceled: "light-dark(#fee2e2, #450a0a)"
  status-canceled-foreground: "light-dark(#991b1b, #fca5a5)"
  status-info: "light-dark(#dbeafe, #172554)"
  status-info-foreground: "light-dark(#1e40af, #93c5fd)"
typography:
  headline:
    fontFamily: 'Montserrat, Inter, "Helvetica Neue", Arial, sans-serif'
    fontSize: 36px
    fontWeight: 600
    lineHeight: 40px
  title:
    fontFamily: 'Montserrat, Inter, "Helvetica Neue", Arial, sans-serif'
    fontSize: 18px
    fontWeight: 600
    lineHeight: 28px
  body:
    fontFamily: 'Montserrat, Inter, "Helvetica Neue", Arial, sans-serif'
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
  label:
    fontFamily: 'Montserrat, Inter, "Helvetica Neue", Arial, sans-serif'
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
rounded:
  md: 6px
  lg: 8px
  xl: 12px
  2xl: 16px
  3xl: 24px
spacing:
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  5: 20px
  6: 24px
  8: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: 0 12px
  button-outline:
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: 0 12px
  button-destructive:
    backgroundColor: "light-dark(color-mix(in srgb, var(--destructive) 10%, transparent), color-mix(in srgb, var(--destructive) 20%, transparent))"
    textColor: "{colors.destructive}"
    rounded: "{rounded.md}"
    padding: 0 12px
  button-icon:
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    size: 32px
  employee-input:
    rounded: "{rounded.lg}"
    height: 40px
    padding: 0 12px
  category-chip:
    backgroundColor: "var(--showroom-category-foreground)"
    textColor: "var(--showroom-category)"
    rounded: "{rounded.xl}"
    height: 44px
    padding: 8px 12px
  showroom-card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.6}"
---

# Design System: Forge Registry

## Overview

**Creative North Star: "Component workbench"**

The component workbench is practical, restrained, and easy to scan. It uses neutral backgrounds, teal action accents, a sans-serif type stack, bordered cards, and compact controls. Its shared header and preview frame keep navigation and settings consistent across demos. Customer applications supply their own theme values through the same semantic roles.

Compact and restrained controls keep attention on component behavior. Borders and small shadows create a lightly layered interface. This record preserves the current implementation, including the differences between existing plugins.

- Neutral surfaces with semantic action and status colors.
- Shared preview geometry with separate reusable component defaults.
- Compact controls, visible borders, and restrained use of shadows.

## Colors

The primary pair switches between deep teal and pale blue with the active theme.
Primary actions use its matching foreground. Neutral surfaces share the host
background; muted copy, borders, and input strokes use translucent foregrounds.
The frontmatter preserves the stylesheet's CSS color syntax and light/dark pairs.

Card, popover, secondary, muted, accent, ring, chart, and sidebar roles retain
those names and the aliases defined in [the stylesheet](./src/styles/globals.css).
Permanently dark sections use the separate dark and dark-foreground pair.
Status colors retain green for success, orange for pending, gray for not started,
red for canceled, and blue for informational states, with readable status text.

Hosts own token values. The showroom saves Light/Dark selection across routes and
portaled dialogs; its shared header has no System or font selector.

## Typography

The declared heading and body roles share the same sans-serif stack. The serif
role names a heading function, despite currently mapping to a sans-serif family.
The stylesheet does not load Montserrat or Inter font files, so installed fonts
and browser fallbacks determine the rendered face. Code uses the existing system
monospace stack. Do not claim that a declared font is downloaded by the showroom.

The frontmatter records the directory's desktop heading hierarchy and common
body and label sizes. The main heading uses 30px below 40rem and 36px above it.
Directory descriptions use 14px text with a relaxed 22.75px line height.
Category labels use 12px sentence-case text. Larger page demos have their own
heading scales; these directory measurements are not a universal heading limit.

## Layout

The showroom has a sticky 56px header, a standard 80rem maximum width, and fluid
16px to 32px gutters. Narrow previews cap at 48rem; full previews remove the width
cap and outer padding. Use the existing ShowroomPreview width options.

Settings start hidden below 40rem and open on larger screens. Open settings occupy
a separate 18rem column at 64rem and above, and stack above the preview below that
breakpoint. An icon-only Settings button beside the panel
title toggles its content while preserving values. The collapsed panel keeps
only the gear button and its padding. Below 40rem, the collapsed gear shares the
preview’s first row, allowing content to flow beside it. The directory uses one column, two at
40rem, and three at 64rem, with 16px gaps. Controls wrap with gaps in both axes.

Reusable page sections use the existing container and section-spacing helpers.
Their host requirements are separate from showroom geometry. Adjacent action
buttons retain at least 4px spacing; toolbars and form actions normally use 8px.

### Layout stability

Design asynchronous states to avoid layout shifts. Keep established headings,
table headers, guidance and controls mounted while data reloads. Retain loaded
rows during background requests and disable unavailable actions without hiding
them. Put initial loading, empty and error feedback inside the existing content
region, using a spanning table row where applicable. Reserve space for content
whose permissions or size are not yet known without implying access. Use fixed
toasts for brief action confirmations. Verify the positions of persistent elements
across these transitions on desktop and mobile in both themes. New data may
naturally change content height; temporary feedback should not move the surrounding
interface.

### Table action alignment

Keep action headers and cells sticky at the right edge on every screen size,
including mobile. Use the shared table styles so horizontally scrolling content
passes beneath the themed action surface while controls remain visible.
Keep each row's actions in the same order and positions. Render an action that is
unavailable for a particular row as a visibly disabled control, with its existing
icon, accessible name and tooltip. Disabled actions always use the same neutral
gray treatment as disabled pagination, including destructive actions; remove their
red or brand-colored tint in both themes and on hover. For example, keep self-delete
disabled and keep verification disabled for an already verified employee. Retain native disabled
semantics, non-clickable cursors, confirmation flows and server authorization.
Features absent from the whole table or hidden by the host's access policy may
remain omitted. Verify mixed eligible/ineligible rows and pending states at desktop
and mobile widths. See the shared [table action contract](https://github.com/the-factory-forge/forge-spec/blob/main/openspec/specs/shared-ui/spec.md#requirement-stable-table-row-actions).

## Elevation & Depth

The interface is lightly layered, combining borders and small soft shadows.
Directory cards and shared search controls use borders without shadows. Card hover uses
a faint primary tint and stronger border. Preview controls use the same faint
tint with small shadows on select fields; dialogs use larger shadows above a
backdrop. Exact shadow values live in the sidecar.

## Shapes

Directory cards use the 2xl radius; administrative form and preview controls use lg. Search,
category filters, and shared header controls use xl. Customer, project, blog and Drive cards and dialogs use xl. Reservation panels retain 2xl.
Status badges use fully rounded ends. Borders are normally
one pixel wide and use the host's semantic roles.

## Components

### Buttons

Administrative plugin action buttons use md corners, 32px desktop minimums, 40px
mobile targets, 12px horizontal padding, medium 14px labels, and 8px icon gaps. Primary, outlined, destructive, and icon variants
reuse each plugin's existing styles. CTA links have their own 44px and 48px sizes.
Focus uses the ring role. Enabled actions have pointer cursors; disabled actions
retain their disabled semantics. Destructive controls use red text on a subtle
tinted surface, including confirmation dialogs. The implemented registry components
are the visual reference for controls, status indicators, layout, and navigation.

### Loading feedback

Use one 4px primary loading bar directly beneath the navbar. It overlays content
without changing layout or focus. Real loading states share its activity queue;
show it immediately and hide 300ms after the final activity settles. New work
cancels a pending hide. Use a subtle pulse with a static reduced-motion fallback.
Keep errors and recovery beside their controls.

### Active controls

Controls that stay selected, pressed, current or expanded must visibly differ
from their inactive state after hover and focus leave. Follow the shared
[active-state contract](https://github.com/the-factory-forge/forge-spec/blob/main/openspec/specs/shared-ui/spec.md#requirement-persistent-active-control-states).
Reuse semantic tokens and existing variants; panel toggles such as Blog History
use the primary background/foreground pair while open and an outline when closed.
Keep the active treatment recognizable on hover, preserve a separate focus ring,
and expose the corresponding native or ARIA state. State changes must not resize
the control. Verify opening and every closing path in both themes and at narrow widths.

### Inputs

Administrative plugin inputs use a 40px minimum height, lg corners, semantic borders,
and background surfaces. Fields retain disabled and invalid states. Newsletter
fields have visible labels and 44px controls; authentication keeps its larger controls.
Input text stays 16px below the medium breakpoint and 14px above it. Reuse the
specific plugin's field styles rather than adding another competing pattern.
Homepage search retains a 44px height and 36px icon controls. Table searches match
action buttons at 32px on desktop and 40px on mobile, with matching compact corners
and responsive icon controls and input padding. Their collapsed width matches
their height; they expand to 288px, capped by the available space.

### Chips and status labels

Directory category controls are 44px high with visible labels, counts, and optional
leading icons. Component uses blue, Layout violet, Page teal and Plugin gold.
Filters, directory badges and global search badges share the showroom category
surface/foreground pairs from the stylesheet. Inactive filters and badges use
soft fills; selected filters reverse the pair for a solid fill with contrasting
text. Hover adds a border without changing size; keyboard focus retains the
separate ring. All keeps the primary pair. Labels and icons retain their meaning
without color. These tokens stay private to the showroom and do not change plugin
status colors or customer themes. Results show a live
count and a reset action that clears both filters and returns focus to All. Status labels use
the appropriate status pair and visible text with a small decorative dot; they are
not buttons by default. Verification labels that already carry an icon retain it.
Place a summary's primary status opposite its title at the top right. Table status
cells keep their existing columns.

### Cards

Directory cards are links with an icon and title opposite a category label,
a description, and an Open label aligned at the bottom. Padding is 20px on mobile
and 24px above 40rem. Their border and title respond to hover, with visible keyboard focus. The
arrow moves slightly on hover or focus when reduced motion is not requested.
Plugin cards may use different radii; inspect their shared classes before edits.

### Navigation and previews

The shared header contains the official Corner icon, All components navigation,
Light/Dark control, repository link, and a language switch on localized demos.
Skip to preview is the first keyboard stop. Each demo supplies its own settings
to the shared preview frame, which owns positioning and responsive behavior.
ShowroomIntro supplies consistent demo headings and instructions where the component
has none. Notices below controls explain sample-data resets or simulated actions.
Action and field labels use sentence case throughout the administrative plugins.

## Do's and Don'ts

- Do use semantic color roles and their matching foregrounds.
- Do reuse the shared preview frame and the relevant plugin styles.
- Do retain translated labels, keyboard focus, reduced motion, and responsive wrapping.
- Do use icon-only refresh/reload controls with translated accessible names and tooltips; preserve visible text on other actions.
- Don't introduce customer-specific colors into reusable components.
- Don't use showroom-only CSS as an undeclared consumer dependency.
- Don't rename semantic roles when changing a customer theme.
- Don't normalize unrelated component styles as a side effect of a scoped edit.

Source references: [showroom styles](./src/styles/globals.css),
[preview guide](./docs/showroom.md), [directory](./src/routes/index.tsx),
[employee styles](./registry/components/plugins/employees/styles.ts),
[customer styles](./registry/components/plugins/customers/ui.tsx),
[CTA links](./registry/components/cta-button.tsx), and
[shared UI contract](../forge-spec/openspec/specs/shared-ui/spec.md).
