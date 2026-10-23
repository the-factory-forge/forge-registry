# Return email verification to login

## Why

L'Aspic's confirmation links lacked email-prefill and verification feedback on
login. Some sending paths supply no meaningful callback. The requested promotion
makes this a reusable Auth behavior while the site keeps its auth/email adapters.

## What Changes

- Add optional initial email and verification-result props to LoginForm, translated success toast and failure guidance.
- Construct localized login callbacks in L'Aspic's verification email adapter and validate login search state.
- Document host integration, rebuild Auth distribution and record other consumers as follow-ups.

## Capabilities

### Modified Capabilities

- `plugins`: add the email-verification return and feedback contract.

## Impact

The owning OpenSpec root is forge-registry. Implementation belongs to forge-registry
and l-aspic. Existing props remain compatible; no dependencies, data migrations,
provider configuration, production mail or deployment are added. Other websites
and the template are recorded for separate adoption.
