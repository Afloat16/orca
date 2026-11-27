import hashlib
import json
from pathlib import Path
import subprocess
import sys

root = Path.cwd()
bundle = Path(__file__).resolve().parent
manifest = json.loads((bundle / "manifest.json").read_text())
payload = json.loads((bundle / "payload.json").read_text())
expected_head = manifest["checkout"]["head"]
actual_head = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
assert actual_head == expected_head, (actual_head, expected_head)
allowed = {item["path"] for item in payload["files"]}
assert len(allowed) == 3
checksums = {item["path"]: item["sha256"] for item in manifest["artifactFiles"]}
for item in payload["files"]:
    relative = item["path"]
    destination = root / relative
    assert relative.startswith("src/") and relative.endswith(".test.ts")
    assert destination.resolve().is_relative_to(root)
    data = item["content"].encode()
    assert hashlib.sha256(data).hexdigest() == checksums[relative]
    if relative.endswith("session-scanner-opencode-json-parts.test.ts"):
        assert hashlib.sha256(destination.read_bytes()).hexdigest() == manifest["maintainerTestBeforeSha256"]
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)

report = bundle / "result.json"
command = [
    "node", "config/scripts/test-runtime/execution-policy/run-vitest.mjs",
    "run", "--config", "config/vitest.config.ts",
    *[item["path"] for item in payload["files"]],
    "--maxWorkers=1", "--testNamePattern=" + manifest["testNamePattern"],
    "--reporter=json", "--outputFile=" + str(report),
]
completed = subprocess.run(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=180)
print(completed.stdout[-16000:], flush=True)
assert report.is_file(), "No structured test report; this is not behavioral evidence."
result = json.loads(report.read_text())
assert result.get("numRuntimeErrorTestSuites", 0) == 0, "Runtime/module failures are invalid evidence."
assert completed.returncode == 1, ("Expected regression assertion failures", completed.returncode)
assertions = [a for suite in result.get("testResults", []) for a in suite.get("assertionResults", [])]
summary = []
expected_names = {case["name"] for case in manifest["expectedCases"]}
for case in manifest["expectedCases"]:
    found = [a for a in assertions if a.get("title", a.get("fullName")) == case["name"]]
    assert len(found) == 1, ("Missing or duplicated scenario", case["name"], len(found))
    outcome = found[0]
    expected = "passed" if case["expected"] == "pass" else "failed"
    assert outcome["status"] == expected, (case["name"], outcome["status"], expected)
    failures = outcome.get("failureMessages", [])
    if expected == "failed":
        assert failures and all("AssertionError" in failure for failure in failures), (
            "A setup/import/transform error is not a reproduced behavior", case["name"], failures
        )
    summary.append({"name": case["name"], "status": outcome["status"], "failureMessages": failures})
    print(json.dumps(summary[-1], ensure_ascii=False), flush=True)
unexpected = [
    a for a in assertions
    if a.get("status") == "failed" and a.get("title", a.get("fullName")) not in expected_names
]
assert not unexpected, ("Unexpected test failures", unexpected)
assert sum(x["status"] == "failed" for x in summary) == 3
assert sum(x["status"] == "passed" for x in summary) == 1

changed = set(subprocess.check_output(["git", "diff", "--name-only"], text=True).splitlines())
staged = subprocess.check_output(["git", "diff", "--cached", "--name-only"], text=True).strip()
assert not staged, "Unexpected staged changes."
assert changed <= allowed, ("Production files changed", changed - allowed)
untracked = subprocess.check_output(["git", "ls-files", "--others", "--exclude-standard"], text=True).splitlines()
assert all(path in allowed or path.startswith(".orca-regression-payload/") for path in untracked), untracked
assert subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip() == expected_head
final = {
    "head": expected_head,
    "behavioralFailuresReproduced": 3,
    "maintainerControlPassed": 1,
    "productionFilesModified": False,
    "cases": summary,
}
(bundle / "summary.json").write_text(json.dumps(final, ensure_ascii=False, indent=2) + "\n")
print("EXPECTED BASELINE REGRESSIONS REPRODUCED: 3 assertion failures; 1 maintainer control passed; production sources unchanged.", flush=True)
