# Security Policy

## Supported Versions

Security fixes should target the current `main` branch until formal releases exist.

## Reporting a Vulnerability

Use GitHub private vulnerability reporting if it is enabled for the repository. If private reporting is not available, contact the maintainer before opening a public issue with exploit details.

Please include:

- Affected commit or version.
- Reproduction steps.
- Whether the issue requires a live provider key, local bridge, or generated match data.
- Any logs with secrets removed.

## Runtime Safety Notes

- Cognitive Pong runs in mock mode by default and should not require secrets for local development.
- API keys belong in server environment variables or per-agent local configuration, never in committed files.
- Session and configuration exports redact API keys, bearer tokens, and common secret aliases while preserving non-secret provider, model, and endpoint metadata.
- Local CLI and Codex CLI bridges are disabled unless `COGNITIVE_PONG_ENABLE_LOCAL_BRIDGES=true`.
- Do not enable local command bridges in shared, hosted, or untrusted environments.
- Treat provider, bridge, and match data as untrusted input.
