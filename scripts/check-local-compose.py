"""Keep the UI-only Compose stack reachable only from the local host."""

import json
import sys


config = json.load(sys.stdin)
violations = []
for service, definition in config["services"].items():
    for port in definition.get("ports", []):
        if port.get("host_ip") != "127.0.0.1":
            violations.append(f"{service}:{port['target']}")

if violations:
    print("Public local-stack ports: " + ", ".join(violations), file=sys.stderr)
    sys.exit(1)

assert config["services"]["econmind-api"]["environment"]["MOCK_API_HOST"] == "0.0.0.0"
print("Local Compose port bindings: OK")
