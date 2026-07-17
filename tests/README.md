# Tests

The initial schema-contract tests cover boundaries that must exist before any
runtime implementation:

1. raw material input cannot cross into `ActivityContext`;
2. non-allowlisted and under-three-inappropriate categories are rejected;
3. kindergarten standards cannot appear in the `3–4` contract;
4. infant/toddler experience modes remain age-coupled; and
5. unrecognized `RummageToolSpec` kinds are rejected.

UI, API, seeded-fixture, failure-path, and accessibility tests begin with the
first approved vertical slice.
