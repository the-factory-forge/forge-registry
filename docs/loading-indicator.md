# Loading indicator

Install `@forge/loading-indicator` to share loading feedback across an app. Wrap
its content in `LoadingProvider` and mount one `LoadingIndicator` beneath the
navbar. The showroom's existing plugin demos demonstrate the component; it has
no standalone directory card.

```tsx
import {
  LoadingIndicator,
  LoadingProvider,
  useLoadingActivity,
  useLoadingTask,
} from "@/components/loading-indicator";

<LoadingProvider>
  <Navbar />
  <LoadingIndicator label="Loading…" className="top-14" />
  <AppContent />
</LoadingProvider>;
```

Use the host's actual navbar offset instead of `top-14` when its height differs.
The fixed, pointer-transparent bar preserves page layout and focus. It uses
semantic primary colors and a bar that fills from the left, holds below full
while loading, then fills completely over 300ms before disappearing. Reduced-motion
preferences retain a static bar. The indeterminate progress element has a
translated accessible name; it does not report a made-up completion percentage.

Call `useLoadingActivity(loading)` with an existing data-loading boolean. For an
imperative async action, use `const track = useLoadingTask()` and
`await track(() => client.refresh())`. Tracking preserves the promise's result or
error; existing error recovery stays with its component. Hosts should keep their
existing local loading and disabled states.

Activity shows the bar immediately. It stays visible while any source is active,
then hides 300ms after the last source completes. New work cancels the pending
hide. Unmounting a source releases its activity, and unmounting the provider
cleans up the timer. Nested providers share their ancestor's queue; separate app
roots have independent queues. Hooks work without a provider and retain their
normal data behavior, but do not display a bar.

Auth, Blogs, Customers, Drive, Employees, Menus, Projects and Reservations declare
this item and report their read/refresh loading states. Blog imperative actions
also report activity so even immediately settled refreshes receive feedback.
The showroom additionally reports router navigation through its framework adapter.
Consumers place the provider and indicator once in their own app shell and wire
any host-owned loading states; registry source does not import a framework router.
Existing installed copies and deployed sites require a reviewed source update.
