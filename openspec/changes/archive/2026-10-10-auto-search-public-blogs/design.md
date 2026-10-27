## Design

Keep BlogIndexPage's native GET form and existing actionHref, search and category
props. A 300 ms timer restarts on edits, stops on submission or navigation and waits
for text composition to finish. Clearing uses the same submission path. Enter
still submits immediately, including without JavaScript. The showroom already
intercepts bubbled submit events for router navigation, so its adapter needs no change.

The Blogs item already ships public.tsx and depends on React through the host.
Regenerate its official shadcn output. Keep searchSubmit in the labels type for
compatibility. The inspected l-aspic and osthoepathie-seebach copies still use a
manual form. They require reviewed adoption; forge-template has no Blogs install.

Verify debounce timing, one submission, clearing, category preservation, Enter,
composition, navigation cleanup and desktop/mobile layout with existing browser tools.
