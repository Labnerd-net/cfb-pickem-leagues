# Spec Action

1. Check $ARGUMENTS (after "spec"):
  - If it's multiple words, extract:
    - a short `feature_title` that is a human readable title in Title Case.
      - Example: "Card Component for Dashboard Stats"
    - a git save `feature_slug` that is:
      - Lowercase
      - Kebab-case
      - Only `a-z`, `0-9` and `-`
      - Replace spaces and punctuation with `-`
      - Collapse multiple `-` into one
      - Trim `-` from start and end
      - Maximum length 40 characters
      - Example: `card-component` or `card-component-dashboard`
    - a `branch_name` in the format `claude/feature/<feature_slug>`
      - Example: `claude/feature/card-component`
  - If empty: Error - "spec" requires a feature description
  - If you cannot infer a sensible `feature_title` and `feature_slug`, ask the user to clarify instead of guessing.

2. Draft the spec content:
  - Create a markdown spec document that Plan mode can use directly and save it in the context/specs/ folder using the `feature_slug`
  - Use the exact structure as defined in the spec template file here: @context/specs/template.md
  - Do not add technical implementation details such as code examples.

3. Add the following data to the @context/current-feature.md file under "Current Feature Spec File" heading
  - Title: <feature_title>
  - Spec file: context/specs/<feature_slug>.md
  - Branch: <branch_name>

## Output

After the file is saved, respond to the user with a short summary in this exact format:

Title: <feature_title>
Spec file: context/specs/<feature_slug>.md
Branch: <branch_name>
