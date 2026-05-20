# Quickstart: Customer Service Plan

1. Run focused plan tests:

   ```bash
   pnpm test __tests__/customer-service-plan.test.ts
   ```

2. Run full validation:

   ```bash
   pnpm test
   pnpm lint
   pnpm build
   ```

3. Start the app if it is not already running:

   ```bash
   pnpm dev
   ```

4. Open a public quote such as `/quote/demo_lighting` or a seeded quote id and
   confirm:

   - The customer service plan appears near the top of the page.
   - The primary action changes for photos, sent quotes, approved quotes,
     expired quotes, and survey-required quotes.
   - The plan is readable on mobile and does not push the package chooser into
     an unusable position.
