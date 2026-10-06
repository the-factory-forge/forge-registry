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
    rounded: "{rounded.lg}"
    padding: 0 12px
  button-outline:
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 0 12px
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    rounded: "{rounded.lg}"
    padding: 0 12px
  button-icon:
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    size: 32px
  employee-input:
    rounded: "{rounded.lg}"
    height: 36px
    padding: 0 12px
  category-chip:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
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

Settings occupy a separate 18rem column at 64rem and above. Below that breakpoint
they remain expanded above the preview. The directory uses one column, two at
40rem, and three at 64rem, with 16px gaps. Controls wrap with gaps in both axes.

Reusable page sections use the existing container and section-spacing helpers.
Their host requirements are separate from showroom geometry. Adjacent action
buttons retain at least 4px spacing; toolbars and form actions normally use 8px.

## Elevation & Depth

The interface is lightly layered, combining borders and small soft shadows.
Directory cards and directory search use borders without shadows. Card hover uses
a faint primary tint and stronger border. Preview controls use the same faint
tint with small shadows on select fields; dialogs use larger shadows above a
backdrop. Exact shadow values live in the sidecar.

## Shapes

Directory cards use the 2xl radius; employee and preview controls use lg. Search,
category filters, and shared header controls use xl. Some customer-plugin inputs use 2xl, and its cards and dialogs
use 3xl. These are observed differences, not a request to standardize them.
Status badges use fully rounded ends. Borders are normally
one pixel wide and use the host's semantic roles.

## Components

### Buttons

Plugin action buttons are at least 36px high with 12px horizontal padding, medium
14px labels, and 8px icon gaps. Primary, outlined, destructive, and icon variants
reuse each plugin's existing styles. CTA links have their own 44px and 48px sizes.
Focus uses the ring role. Enabled actions have pointer cursors; disabled actions
retain their disabled semantics. Delete actions keep their confirmation dialogs.

### Inputs

Employee inputs are 36px high with lg corners and a small shadow. Customer inputs
are 32px high with 2xl corners. Both use semantic borders and focus treatment.
Input text stays 16px below the medium breakpoint and 14px above it. Reuse the
specific plugin's field styles rather than adding another competing pattern.

### Chips and status labels

Directory category controls are 44px high with visible labels, counts, and optional
leading icons. The selected category uses the primary pair. Results show a live
count and a reset action that clears both filters and returns focus to All. Status labels use
the appropriate status pair and visible text; they are not buttons by default.
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

## Do's and Don'ts

- Do use semantic color roles and their matching foregrounds.
- Do reuse the shared preview frame and the relevant plugin styles.
- Do retain translated labels, keyboard focus, reduced motion, and responsive wrapping.
- Do preserve visible action text and the shared Lucide action icons.
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
