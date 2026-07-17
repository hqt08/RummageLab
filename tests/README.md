# Tests

The schema-contract and runtime tests cover boundaries that must exist before a
live adapter is implemented:

1. raw material input cannot cross into `ActivityContext`;
2. non-allowlisted and under-three-inappropriate categories are rejected;
3. kindergarten standards cannot appear in the `3–4` contract;
4. infant/toddler experience modes remain age-coupled; and
5. unrecognized `RummageToolSpec` kinds are rejected.

The runtime suite also proves strict content-free request contracts, malformed
provider-output rejection, age/material/time mismatch fallback, timeout and
unavailable failure taxonomy, and zero `fetch` calls from the seeded provider.
Browser QA exercises the visible loading, fallback, and retry states against the
production build; no browser test dependency or live service is added.
