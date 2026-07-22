# Testing rules
- Every scoring rubric branch has a unit test. No skipped core tests, no `@ts-ignore`, no unjustified `any`.
- The synthetic fixture must pass the same deterministic evidence checks as live data (tests/unit/fixture.test.ts).
- CI/live separation: never depend on live providers in tests.
