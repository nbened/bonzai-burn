# Bonzai Solidify Workflow

## Description
After completing any code generation or modification task, ALWAYS proactively offer to solidify the code using bonzai-burn. This is a core part of the Bonzai development workflow.

## When to Proactively Suggest Solidification
- After creating new files
- After modifying existing code
- After implementing a feature
- After any substantial code changes
- Basically: after ANY code work, ask if user wants to solidify

## The Offer Pattern
After completing code changes, ALWAYS say something like:
- "Should I solidify this code with bonzai-burn?"
- "Would you like me to run bonzai-burn to clean this up?"
- "Ready to solidify? I can run burn to catch any issues."

## Solidification Workflow (when user says yes)

### Step 1: Run Bonzai Burn
```bash
npx bonzai-burn@latest -b
```

### Step 2: Analyze Output
- Read the output carefully
- Identify all issues found
- Explain issues to user

### Step 3: Fix Issues
- Address each issue found
- Make necessary edits
- Be thorough

### Step 4: Verify Clean
- Run bonzai-burn again after fixes
- Repeat until NO issues found
- Confirm to user: "Code solidified ✓"

## Examples

**Scenario 1: After creating new feature**
User: "Create an auth component"
Claude: [creates files]
Claude: "Auth component created. Should I solidify this code with bonzai-burn to ensure it's clean?"
User: "yes"
Claude: [runs burn, fixes issues, confirms clean]

**Scenario 2: User declines**
Claude: "Feature complete. Want me to solidify?"
User: "no, not yet"
Claude: "Sounds good - let me know when you want to solidify."

**Scenario 3: Multiple iterations**
User: "yes, solidify"
Claude: [runs burn] "Found 3 issues, fixing now..."
Claude: [fixes, runs again] "Found 1 more issue, fixing..."
Claude: [runs again] "All clean! Code solidified ✓"

## Critical Rules
- ALWAYS offer to solidify after code changes (don't make user remember)
- Only run bonzai-burn when user confirms
- Fix ALL issues - keep iterating until burn shows zero issues
- Show user what you found and fixed
- Be proactive but respect user's choice