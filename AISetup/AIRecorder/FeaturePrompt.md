Read:

1. AIRecorder/Code.ts
2. AIRecorder/FrameworkPrompt.md

Generate:

1. Feature file (.feature)
2. Feature title
3. Scenario title
4. Given/When/Then steps
5. Use existing step definitions if available.
6. Use Excel driven steps.
7. Avoid duplicate steps.
8. Follow Gherkin syntax.

Rules:

- Prefer reusable steps.
- Business readable language.
- No technical implementation details.
- Use Scenario Outline when appropriate.
- Reuse existing login/navigation steps.
- Do not generate new steps if matching steps already exist.