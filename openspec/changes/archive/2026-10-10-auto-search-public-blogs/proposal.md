## Why

Visitors expect public blog search to update after typing pauses. A separate
Search button adds an unnecessary action.

## What changes

Remove the public Search button and submit the existing GET form after a short
pause. Preserve category filters, Enter submission and host submit interception.

## Capabilities

### Modified capabilities

- `plugins`: public blog search submits automatically after typing or clearing.

## Impact

The owning change root is forge-spec. Source, browser checks, integration guides
and generated Blogs output belong to forge-registry. No public props, dependencies,
storage or authorization change. Consumer installation and deployment remain separate.
