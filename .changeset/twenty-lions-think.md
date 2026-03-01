---
"@azwebmaster/openapi-to-ts": patch
---

Fix missing namespace client type imports for composed response schemas and add stronger integration coverage.

### Included
- fix generator import collection so referenced schema types in namespace signatures are imported correctly
- add regression tests for `oneOf`, `anyOf`, and `allOf` import cases
- add GitHub OpenAPI integration test in `tests/integration/`
- update CI to run integration tests from dedicated integration test folder
