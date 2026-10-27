# Account tabs and email confirmation

## Why

Accounts can have fields from several plugins. Keep those sections separate and
protect administrator email changes with provider confirmation.

## Changes

- Allow site-supplied tabs alongside About and Security, retaining unsaved input.
- Offer an optional email-change form that keeps the current address until confirmation.

## Scope

Forge Spec owns these `plugins` requirements; Registry implements them in `auth`.
Sites choose authorized tabs and connect their authentication provider. This PR
changes documentation only and requires no database migration.
