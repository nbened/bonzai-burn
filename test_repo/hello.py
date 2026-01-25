import sys
import json

issues = ["Issue 1", "Issue 2"]

if issues:
    response = {
        "continue": False,  # Block stopping
        "stopReason": "⚠️ BONZAI BURN FOUND ISSUES:\n" + "\n".join(f"• {i}" for i in issues)
    }
    print(json.dumps(response))
    sys.exit(2)  # Block the stop
else:
    sys.exit(0)  # Allow stop