# Agentic Coding Sandbox → CI/CD → Production

## Architecture overview

This repo now has three distinct, deliberately different setups. They
share source code via git, but nothing else crosses between them:

| File | Used where | What it runs |
|---|---|---|
| `Dockerfile.dev` + `docker-compose.dev.yml` | Your laptop | The AI agent sandbox: SSH, nvim, OpenCode/Claude Code, bind-mounted source, egress-limited to your LLM provider |
| `.github/workflows/ci-cd.yml` | GitHub Actions | Secret scan → test → build the production image → push → deploy |
| `Dockerfile.prod` + `docker-compose.yml` | Your VPS | The actual running app: minimal image, code baked in, no dev tooling, pulls a pre-built tag |

**Why they're different Dockerfiles, not one file with flags:** the dev
container's whole job is to let an agent read/write source live (bind
mount) and call an LLM. The production container's whole job is to run a
finished, immutable artifact as small and locked-down as possible. Trying
to make one Dockerfile serve both ends up compromising on both — either
your dev environment doesn't match production, or your production image
ships an SSH server and a coding agent it will never use.

## The pipeline, end to end

1. **You + the agent** edit code locally inside `agent-dev`, via the bind
   mount. Nothing here is deployed directly — this container never ships
   anywhere.
2. **Push to git.** This is the only thing that leaves your machine at
   this stage — plain source code, no secrets (gitleaks blocks that
   locally via the pre-commit hook, and again in CI as a backstop).
3. **CI: secret-scan job** re-runs gitleaks against the pushed commit,
   independent of whether your local hook ran.
4. **CI: test job** installs dependencies fresh and runs lint/tests in a
   clean environment — this is what actually verifies the agent's changes
   didn't break anything, not your local run.
5. **CI: build-and-push job** builds `Dockerfile.prod` (multi-stage: a
   build stage with full toolchain, a runtime stage with only the
   compiled output + pruned production dependencies) and pushes it to a
   registry (GHCR here) tagged by commit SHA.
6. **CI: deploy job** SSHes into the VPS using a deploy-only key and tells
   the VPS's `docker-compose.yml` to pull that exact tag and restart.
   The VPS never builds anything — it only ever pulls finished images.

## Where secrets live at each stage

| Stage | Secret storage | Notes |
|---|---|---|
| Local dev | Host `.env`, outside `SOURCE_DIR` | Injected as container env vars, per section 5 below |
| GitHub Actions | Repo/Org **Encrypted Secrets** (`Settings → Secrets and variables → Actions`) | `VPS_DEPLOY_KEY`, `VPS_HOST`, registry creds — never appear in logs or the repo |
| Image build | BuildKit `--mount=type=secret` only, if needed | Regular `ARG`/`ENV` secrets get baked into image layer history and can be extracted later — avoid this entirely |
| Production (VPS) | `.env` file that lives only on the VPS filesystem, referenced via `env_file:` | Deployed once out-of-band (e.g. manually via `scp`, or written by a separate secured provisioning step) — never committed, never built into the image |

The rule that holds everywhere: **a secret is either an environment
variable injected at run time, or it doesn't exist as a file at all.** It
should never be something `COPY`'d into an image or sitting inside a
bind-mounted folder.

## Setting up the VPS side (one-time)

```bash
# On the VPS
mkdir -p /opt/my-project && cd /opt/my-project
# Place docker-compose.yml (the production one) here
# Create .env here with real production values -- NOT from git
nano .env

# Create a deploy-only SSH key pair, add the public half to
# ~deploy/.ssh/authorized_keys on the VPS, and the private half as the
# GitHub Actions secret VPS_DEPLOY_KEY
docker login ghcr.io -u <github-username>   # once, so `docker compose pull` can auth
```

From then on, every merge to `main` flows all the way through to the VPS
automatically, and the VPS's job is reduced to "pull and restart."

---



## 1. Setup

```bash
cp .env.example .env
# edit .env: set SOURCE_DIR to your project folder, add your API key(s)

ssh-keygen -t ed25519 -f ~/.ssh/agent_dev_key -C "agent-dev"
cat ~/.ssh/agent_dev_key.pub >> config/authorized_keys

docker compose -f docker-compose.dev.yml build
docker compose -f docker-compose.dev.yml up -d
```

## 2. Connect

### Option A — Neovim over plain SSH (lighter, recommended if you're
comfortable in nvim)

```bash
ssh -i ~/.ssh/agent_dev_key -p 2222 coder@localhost
tmux new -s dev
nvim .
```

Open a second tmux pane and run the agent CLI alongside your editor:

```bash
tmux split-window -h
opencode        # or: claude   /   aider
```

### Option B — VSCodium Remote-SSH

1. Install the **Remote - SSH** extension from Open VSX (not the Microsoft
   Marketplace version — VSCodium can't use that one).
2. Add to your local `~/.ssh/config`:
   ```
   Host agent-dev
       HostName localhost
       Port 2222
       User coder
       IdentityFile ~/.ssh/agent_dev_key
   ```
3. `Remote-SSH: Connect to Host` → `agent-dev`.
4. Open `/home/coder/workspace` — that's your bind-mounted source.
5. Open a terminal inside the VSCodium remote window and run `opencode` /
   `claude` / `aider` there — it executes inside the container either way.

> Note: VSCodium's Remote-SSH will auto-download the VS Code Server into the
> container's `/home/coder/.vscode-server` on first connect. That download
> does not persist if you rebuild the image, only if the container itself
> stays alive — a `docker compose down` + `up` recreates it, `docker compose
> stop` + `start` does not.

## 3. Swapping the agent CLI

The Dockerfile installs **OpenCode** by default (provider-agnostic: works
with Anthropic, OpenAI, OpenRouter, local models). To switch:

- **Claude Code**: uncomment `RUN sudo npm install -g @anthropic-ai/claude-code`
- **Aider**: uncomment `RUN pip install --user --break-system-packages aider-chat`
- **OpenHands / Goose / Codex CLI / Gemini CLI**: add their install steps the
  same way, following each project's install docs.

Then `docker compose -f docker-compose.dev.yml build` again.

## 4. What the container can and can't see

- ✅ Can see: the one folder you set as `SOURCE_DIR`, mounted at
  `/home/coder/workspace`.
- ❌ Cannot see: your host filesystem, other repos, SSH keys, dotfiles,
  browser data, other containers — nothing outside the mount and the image
  itself.
- Network: only what you allow. By default it's unrestricted egress (needed
  to reach the LLM API); add an egress allowlist/proxy if you want to
  restrict it further (e.g. to just `api.anthropic.com`).

## 5. Secrets: keeping the agent from seeing them

`.dockerignore` does **not** protect secrets in this setup, because the
workspace is bind-mounted, not baked into the image — bind mounts skip
`.dockerignore` entirely. Instead:

- **Never put real secrets in a file inside `SOURCE_DIR`.** Keep `.env`
  (with real values) on your host, *outside* the mounted folder. Use
  `.env.example` (no real values) inside the repo for documentation.
- Docker compose reads your host-side `.env` only to fill in the
  `environment:` block — those values become process env vars inside the
  container, not a file the agent can `cat` or `grep`.
- Your app should read secrets via `process.env.X` (or your language's
  equivalent), not by loading a committed `.env` file from the workspace.
- `my-project/.aiderignore` tells agent CLIs that support it to skip
  secret-shaped files as an extra layer — not a hard guarantee, since a
  shell-capable agent can still bypass an ignore file if it really tries.
- If your app *must* read an actual secrets file at runtime, chmod it
  `600` and own it by a user other than the one the agent runs as, so the
  OS blocks the read regardless of what the agent tries.

## 6. Egress allowlist (blocks exfiltration + limits what the LLM sees)

The `agent-dev` container now has **no direct internet access**. All
outbound traffic is forced through the `egress-proxy` service, which only
allows the domains listed in `config/proxy/allowed-domains.txt` (your LLM
provider(s), plus package registries if you uncomment them).

This is your main defense against prompt-injection-driven exfiltration —
even if a malicious file or dependency tries to trick the agent into
sending data somewhere, there's nowhere for it to go except your approved
provider's API.

To add a provider or package registry, edit
`config/proxy/allowed-domains.txt` and run `docker compose -f docker-compose.dev.yml up -d --force-recreate egress-proxy`.

## 7. Catch accidental secret leaks before they're committed

```bash
cp config/hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

Requires [gitleaks](https://github.com/gitleaks/gitleaks) on your PATH (or
use the Docker one-liner printed by the hook if you'd rather not install
it locally). This scans every commit's staged changes against known
secret patterns (AWS keys, private keys, generic API tokens, etc.) and
blocks the commit if it finds one — regardless of whether the agent or
you introduced it.

## 8. Optional hardening already included

- `cap_drop: ALL` with only `CHOWN`/`SETUID`/`SETGID` re-added
- `no-new-privileges`
- SSH is key-auth only, root login disabled
- `/tmp` is tmpfs (wiped on restart)
- `read_only: true` is available in `docker-compose.yml` (commented out) —
  enable it once you've confirmed your agent CLI doesn't need to write
  outside the workspace and `/tmp`.
