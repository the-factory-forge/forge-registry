export const tableSelectionLabels = {
  selectRow: "Select row",
  selectAllRows: "Select all rows",
  deleteSelected: "Delete selected items",
  bulkDeleteTitle: "Delete selected items?",
  bulkDeleteDescription: "This action cannot be undone.",
  bulkDeleteError: "Some items could not be deleted. Only the items below remain to retry.",
  bulkPrepareError: "Could not prepare deletion. Try again before confirming.",
  bulkDeleted: "Selected items deleted",
  bulkPending: "Please wait…",
  bulkCancel: "Cancel",
  bulkClose: "Close",
  bulkConfirm: "Delete",
  bulkRetry: "Try again",
};
export type TableSelectionLabels = Omit<typeof tableSelectionLabels, "bulkClose"> & {
  bulkClose?: string;
};
