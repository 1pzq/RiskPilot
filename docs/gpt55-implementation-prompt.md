# GPT-5.5 Implementation Prompt For RiskPilot

Copy this prompt into GPT-5.5 / Codex / another coding agent together with these two documents:

- `docs/riskpilot-project-submission.md`
- `docs/riskpilot-development-requirements.md`

---

You are implementing **RiskPilot**, a Sui Overflow 2026 hackathon project.

Read and follow these documents as the source of truth:

1. `docs/riskpilot-project-submission.md`
2. `docs/riskpilot-development-requirements.md`

Your task is to build the project end to end in this repository.

Critical constraints:

- Use **Sui mainnet**, not any non-mainnet chain environment.
- Use **Walrus mainnet** for audit package storage.
- Use **DeepBook / DeepBook Predict mainnet** for the execution adapter.
- Default execution mode must be `prepare_mainnet`, not live execution.
- Never submit a live mainnet transaction unless the user explicitly confirms it in the wallet and the policy check passes.
- Local simulation is allowed only as a fallback for development or dependency failure. It must be clearly labeled as local simulation.
- Do not claim guaranteed profit or guaranteed protection.
- The app must remain demoable without forcing the user to spend mainnet funds.

Implementation order:

1. Create the Next.js + TypeScript app if it does not exist.
2. Build the app shell and financial dashboard UI.
3. Implement fixture portfolio scenarios.
4. Implement mainnet wallet connection and Sui mainnet balance reading.
5. Implement the deterministic risk engine.
6. Implement the strategy builder.
7. Implement policy review and policy checks.
8. Implement DeepBook mainnet prepare-only adapter with local simulation fallback.
9. Implement Walrus mainnet audit upload with local fallback.
10. Implement AI explanation endpoint with mock fallback.
11. Implement result screen and audit JSON viewer.
12. Add focused unit tests for risk, strategy, and policy logic.
13. Run typecheck, lint, tests, and build.

Definition of done:

- `npm run dev` starts the app.
- The first screen is the actual RiskPilot app, not a marketing landing page.
- A user can connect a Sui mainnet wallet or use demo mode.
- The app shows portfolio composition, risk signals, strategy recommendation, policy checks, execution result, and audit result.
- The default execution path prepares a mainnet DeepBook action without submitting funds.
- Walrus mainnet upload is attempted for audit packages.
- If Walrus or DeepBook is unavailable, the app falls back gracefully and shows a warning.
- No testnet path exists in the product.
- `npm run build` succeeds.

Before making changes, inspect the repository structure. Keep the implementation focused on the requirements and do not add unrelated features.

When you finish, summarize:

- What was implemented.
- Which files changed.
- Which commands were run.
- Whether mainnet execution is prepare-only or live.
- Any missing environment variables or manual setup still needed.
