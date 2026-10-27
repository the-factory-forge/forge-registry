# Employee deletion and photos

## Why

Admins need to review an employee's linked records before deleting the account.
A missing photo must not block saving a profile.

## Changes

- Show linked records by plugin and require deletion choices for single or bulk removal.
- Make photos optional and crop uploads to optimized WebP.

## Scope

Forge Spec owns these `plugins` requirements. Registry implements them in
`employees` and `employees-server`, using `image-crop`. This PR changes documentation
only; sites adopt the source and configure their integrations separately.
