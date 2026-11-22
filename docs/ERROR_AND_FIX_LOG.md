# Error and Fix Log — MindRush

This log records every error, limitation, or blocker encountered during environment preparation, installation, and configuration, along with the exact root cause and applied fix.

---

## Incident 1: `uv` Not Installed in Environment
- **Date:** 2026-11-16
- **Context:** Initial environment inspection.
- **Symptom:** Executing `uv --version` produced:
  ```text
  uv : The term 'uv' is not recognized as the name of a cmdlet, function, script file, or operable program.
  ```
- **Root Cause:** Astral's `uv` tool manager was not previously installed on the Windows system.
- **Resolution:**
  1. Ran `python -m pip install uv` using the pre-existing Python 3.13 installation.
  2. Successfully installed `uv-0.13.8` to the user Python script directory (`%APPDATA%\Python\Python313\Scripts\uv.exe`).
  3. No administrator permissions were required because pip automatically targeted the per-user site-packages directory.

---

## Incident 2: Initial Sandboxed `pip` and `uv` Network / Cache Restriction
- **Date:** 2026-11-16
- **Context:** Attempting package installation inside standard sandboxed execution mode.
- **Symptom:**
  - `python -m pip install uv` returned `ERROR: Could not find a version that satisfies the requirement uv` (no internet connectivity in standard sandbox).
  - `python -m uv tool install` returned `failed to create directory C:\Users\SMIT\AppData\Local\uv\cache: Access is denied` (sandbox restricted writing to global user cache).
- **Root Cause:** Standard agent terminal sandbox restricts both raw outbound network requests and filesystem modifications outside the active workspace directory (`D:\MindRush`).
- **Resolution:** Elevated the specific package installation and shell update commands using unsandboxed execution mode with user approval, strictly isolating host-level modifications to package manager installations.

---

## Incident 3: `C:\Users\SMIT\.local\bin` Missing from Shell PATH
- **Date:** 2026-11-16
- **Context:** Post-installation of `specify-cli`.
- **Symptom:** `uv tool install specify-cli` displayed a warning:
  ```text
  warning: C:\Users\SMIT\.local\bin is not on your PATH. To use installed tools, run $env:PATH = "C:\Users\SMIT\.local\bin;$env:PATH" or uv tool update-shell.
  ```
- **Root Cause:** Windows user environment variable `PATH` did not include the default `uv tool` binary directory (`.local\bin`).
- **Resolution:**
  1. Executed `python -m uv tool update-shell` which updated the user's permanent Windows registry environment key.
  2. Verified that `C:\Users\SMIT\.local\bin\specify.exe` is present and directly executable.

---

## Incident 4: Missing `agy` Binary for Coding Agent Check
- **Date:** 2026-11-16
- **Context:** Running `specify check` to audit agent integrations.
- **Symptom:**
  ```text
  ├── ● Antigravity (not found)
  ```
- **Root Cause:** Spec Kit's detection probe checks for a standalone terminal binary named `agy.exe` in `PATH`. However, Antigravity IDE and its agent services operate directly within the IDE workspace rather than requiring a dedicated external `agy` CLI binary.
- **Resolution:**
  1. Used `--ignore-agent-tools` and `--integration agy` during `specify init`.
  2. Spec Kit successfully initialized all `.agents/skills/` templates formatted according to Antigravity's native skill specification (`SKILL.md` with YAML frontmatter).
  3. Confirmed Antigravity's workspace skill discovery automatically loads from `.agents/skills/` without needing an external CLI.

---

## Incident 5: Ollama CLI and Local Daemon Not Available (T002)
- **Date:** 2026-11-20
- **Context:** Executing candidate model and Ollama environment verification (`T002`).
- **Symptom:**
  - `ollama` CLI command not recognized in PowerShell PATH.
  - Connection probe to `http://127.0.0.1:11434` returned `TcpTestSucceeded: False`.
  - No active processes matching `*ollama*`.
- **Root Cause:** Ollama is not installed on the Windows host or its service has not been started.
- **Status / Action Taken:**
  - Automated installation, model pulling, or candidate switching without explicit user approval is strictly prohibited under project governance rules.
  - Documented exact findings in `INSTALLATION_AND_ENVIRONMENT_LOG.md`.
  - Stopped execution at T002 gate to report results to user and receive guidance before proceeding.

---

## Incident 6: Loopback Traffic Intercepted by Sandbox HTTP Proxy (T002 Follow-Up)
- **Date:** 2026-11-20
- **Context:** Python `httpx` and `urllib` connecting to local Ollama daemon on `http://localhost:11434`.
- **Symptom:** Requests failed with `403 Port 11434 not allowed for HTTP` (for localhost) or `400 Direct IP access is not allowed` (for 127.0.0.1).
- **Root Cause:** Environment variables `HTTP_PROXY` and `HTTPS_PROXY` were set to the sandbox proxy (`127.0.0.1:61995`). Because `NO_PROXY` was not configured for loopback addresses, Python HTTP clients routed local requests to the external proxy rather than the local Ollama daemon.
- **Resolution:**
  1. Configured `httpx.Client(trust_env=False)` across Python client calls to bypass environment proxy settings for loopback communication.
  2. Verified connection returned `200 OK` and model list `['qwen3.5:4b']`.
  3. Applied pattern to `initial_model_benchmark.py` and documented for `ai_service` HTTP clients.

---

## Incident 7: Qwen 3.5 Default Reasoning Tokens Causing Latency Spikes (T002 Benchmark)
- **Date:** 2026-11-20
- **Context:** Generating questions via Ollama API with candidate model `qwen3.5:4b`.
- **Symptom:** Initial generation requests took >120 seconds and timed out.
- **Root Cause:** Qwen 3.5 activates deep reasoning by default, generating internal `<think>...</think>` chain-of-thought blocks before producing JSON answers.
- **Resolution:**
  1. Added `"think": False` to the Ollama options / request payload.
  2. Latency dropped from >120s (timeout) to 31–34 seconds per question at 7.0–7.6 tokens/sec.
  3. Enforced `"think": False` requirement across prompt builders and Ollama clients.

---

## Incident 8: Broken Windows Prebuild in `argon2@0.45.1` Causing STATUS_ACCESS_VIOLATION (T005–T010)
- **Date:** 2026-11-20
- **Context:** Executing Node.js tests importing `server/utils/auth.js` (`test_foundation_milestone.mjs`, `test_auth.mjs`).
- **Symptom:** Node.js process crashed immediately upon requiring `argon2` with ExitCode `-1073741819` (`0xC0000005`, STATUS_ACCESS_VIOLATION) with no JavaScript error output.
- **Root Cause:** The npm package `argon2@0.45.1` published a prebuild binary `argon2.glibc.node` under `win32-x64` that has an incompatible ABI/CRT structure on Windows with Node 22, causing an unhandled memory access violation upon `process.dlopen`.
- **Resolution:**
  1. Identified that `argon2@0.41.1` provides a fully compatible `win32-x64` prebuilt binary.
  2. Installed `argon2@0.41.1` via `npm install argon2@0.41.1 --ignore-scripts` and updated `package.json`.
  3. Verified `test_auth.mjs` (56/56 passing) and `test_foundation_milestone.mjs` (10/10 passing) with ExitCode 0.



