# Plan Action

1. Enter plan mode
2. Read current-feature.md 
  - verify "Current Feature Spec File" is populated
  - verify "Current Feature Plan File" is not populated
3. If no spec file, error: "Run /feature spec first"
4. Read the "Spec file:" file under "Current Feature Spec File" heading
5. Create and checkout the feature branch listed as "Branch:"
  - If the branch name is already taken, then append a version number to it: e.g. `claude/feature/card-component-01`
  - Save branch name as `branch_name`
6. Create a plan to implement the spec in the current feature spec file
7. Exit plan mode
8. copy plan to file in context/features/ using the same filename as the spec file saved as `feature_filename`
9. Add the following data to the @context/current-feature.md file under "Current Feature Plan File" heading
  - Plan file: context/features/<feature_filename>

## Output

After the file is saved, respond to the user with a short summary in this exact format:

Spec file: context/spec/<feature_filename>
Plan file: context/features/<feature_filename>
Branch: <branch_name>
