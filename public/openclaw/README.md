# CompliGuard OpenClaw Skill Pack

Connect AI agents to CompliGuard's GRC platform via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) and [OpenClaw](https://openclaw.dev).

---

## What is OpenClaw?

OpenClaw is an open-source framework for building and distributing AI agent skill packs. Skills are published to [ClawHub](https://clawhub.dev) or self-hosted OpenClaw instances. Each skill exposes a set of tools an AI agent can call to interact with external systems.

CompliGuard ships as a first-class OpenClaw skill, meaning any OpenClaw-compatible AI agent can manage your compliance program through natural language — without custom integration code.

---

## Installation

### Option A: ClawHub (Recommended)

1. Open your OpenClaw admin panel.
2. Go to **Skills → Browse ClawHub**.
3. Search for **CompliGuard GRC**.
4. Click **Install**.
5. Enter your CompliGuard deployment URL (e.g. `https://grc.yourcompany.com`).
6. Paste your MCP API key (see [Creating an API Key](#creating-an-api-key) below).
7. Click **Connect** — the agent will auto-discover available tools from `/api/mcp/manifest`.

### Option B: Self-hosted OpenClaw (Manual registration)

1. In your OpenClaw config, add a new skill entry:

```yaml
skills:
  - name: compliguard
    url: https://YOUR_DOMAIN/api/mcp
    auth:
      type: bearer
      token: YOUR_MCP_API_KEY
    manifest: https://YOUR_DOMAIN/api/mcp/manifest
```

2. Reload your OpenClaw instance. The 10 CompliGuard tools will appear in the agent's tool list.

### Option C: Claude Desktop

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "compliguard": {
      "url": "https://YOUR_DOMAIN/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_MCP_KEY" }
    }
  }
}
```

Restart Claude Desktop. You can now ask Claude to interact with your compliance data.

---

## Creating an API Key

1. Log into CompliGuard and go to **Settings → MCP Server**.
2. Click **Create MCP Key**.
3. Give the key a descriptive name (e.g. "OpenClaw Agent" or "Claude Desktop").
4. Select the appropriate scope:
   - `mcp:read` — Read-only (recommended for most agents)
   - `mcp:write` — Can also create findings and update task statuses
   - `admin:*` — Full access (use with caution)
5. Copy the key immediately — it will not be displayed again.

---

## Available Tools

| Tool | Description | Scope Required |
|------|-------------|---------------|
| `list_frameworks` | List active compliance frameworks with optional control counts and compliance % | `mcp:read` |
| `get_control_status` | Get full control details: title, status, evidence, findings | `mcp:read` |
| `list_findings` | List findings filtered by severity and status | `mcp:read` |
| `create_finding` | Create a new security or compliance finding | `mcp:write` |
| `list_tasks` | List compliance tasks with status filter | `mcp:read` |
| `update_task_status` | Update a task's status (todo/in_progress/done/blocked) | `mcp:write` |
| `get_compliance_score` | Get overall or per-framework compliance percentage | `mcp:read` |
| `search_controls` | Full-text search across controls by title/description | `mcp:read` |
| `list_evidence` | List evidence items, optionally filtered by control | `mcp:read` |
| `get_risk_summary` | Risk overview: finding counts, overdue tasks, low-score frameworks | `mcp:read` |

---

## Example Queries

Once connected, you can ask your AI agent:

- *"What is our current SOC 2 compliance score?"*
- *"Show me all critical open findings."*
- *"What compliance tasks are overdue?"*
- *"Give me a full risk summary."*
- *"Search for access control requirements in NIST."*
- *"List all pending evidence items."*
- *"Mark task [id] as done."*
- *"Create a finding for the unpatched server vulnerability."*

---

## Security Recommendations

- **Use `mcp:read` scope** for read-only reporting agents. Only grant `mcp:write` to agents that need to create findings or update tasks.
- **Rotate keys regularly** — revoke and recreate keys periodically from Settings → MCP Server.
- **Do not share keys** — create separate keys for each agent or integration.
- **Use `admin:*` only for trusted administrative scripts** — not for general-purpose AI agents.
- Monitor key `Last Used` timestamps in the MCP Server settings to detect unexpected usage.

---

## MCP Protocol Details

- **Endpoint**: `POST /api/mcp`
- **Protocol**: JSON-RPC 2.0 over HTTP
- **MCP Version**: `2024-11-05`
- **Auth**: `Authorization: Bearer <key>` header
- **Manifest**: `GET /api/mcp/manifest` (no auth required)
- **OpenAPI spec**: `/openclaw/openapi.json`

---

## Support

- [CompliGuard Documentation](https://docs.your-domain.com)
- [OpenClaw Documentation](https://openclaw.dev/docs)
- [MCP Specification](https://modelcontextprotocol.io/specification)
- [File an issue](https://github.com/your-org/compliguard/issues)
