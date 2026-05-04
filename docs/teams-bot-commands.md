# CompliGuard Teams Bot — Slash Command Reference

All commands are triggered by sending a message to the CompliGuard bot in Microsoft Teams. Commands are case-insensitive and can be sent in personal chat, group chat, or a team channel where the bot has been added.

---

## Command Summary

| Command | Description |
|---------|-------------|
| [`/compliance`](#compliance) | Overall compliance score and framework breakdown |
| [`/control <id>`](#control-id) | Look up a specific control by ID or name |
| [`/risks`](#risks) | Current risk summary — critical and high severity findings |
| [`/tasks`](#tasks) | Your overdue and upcoming compliance tasks |
| [`/findings`](#findings) | Recent open findings sorted by severity |
| [`/policy`](#policy) | Policy-related controls and findings status |
| [`/help`](#help) | Show all available commands |

---

## Command Details

---

### `/compliance`

**Description:** Shows your organization's overall compliance score and a per-framework breakdown with implementation status.

**Usage:**
```
/compliance
```

**Example Response (Adaptive Card):**

```
📊 Compliance Overview

Overall Score: 78%

Framework         | Controls | Implemented | Score
------------------+----------+-------------+------
SOC 2 Type II     | 64       | 52          | 81%
ISO 27001:2022    | 93       | 70          | 75%
NIST CSF          | 108      | 80          | 74%
HIPAA Security    | 45       | 38          | 84%

[View Dashboard ↗]  [View Frameworks ↗]
```

**Data sources:**
- `organization_frameworks` — which frameworks your org has activated
- `control_assignments` — status of each control (not_started / in_progress / implemented / needs_review / not_applicable)
- Score = `implemented / (total - not_applicable)` per framework

**Notes:**
- Only shows frameworks active for your organization
- `not_applicable` controls are excluded from scoring denominator
- Score is rounded to nearest whole percent

---

### `/control <id>`

**Description:** Looks up a specific control by its identifier (e.g., `AC-1`, `CC6.1`, `A.9.1`) or by searching the title. Returns control details, current status, assignee, and linked findings.

**Usage:**
```
/control AC-1
/control CC6.1
/control access control policy
```

**Example Response (Adaptive Card):**

```
🔒 Control: AC-1 — Access Control Policy

Framework:   NIST SP 800-53 Rev 5
Category:    Access Control
Status:      ✅ Implemented
Assignee:    Jane Smith
Due Date:    Dec 31, 2024
Completed:   Nov 15, 2024

Description:
Develop, document, and disseminate an access control policy
that addresses purpose, scope, roles, responsibilities...

Evidence:    3 items attached
Findings:    1 open finding linked

[View Control ↗]  [View Evidence ↗]
```

**Behavior when control is not found:**
```
❓ Control Not Found

No control matching "XY-999" was found in your active frameworks.

Try:
• Use the control identifier (e.g., AC-1, CC6.1, A.5.1)
• Search by keyword (e.g., /control password policy)
• Use /compliance to see all active frameworks

[View Controls ↗]
```

**Data sources:**
- `controls` table — `controlId`, `title`, `description`, `category`
- `control_assignments` — `status`, `assignedTo`, `dueDate`, `completedAt`
- `findings` — linked findings count (via metadata or direct FK if available)

**Notes:**
- Search is case-insensitive
- If multiple controls match, returns the best match (exact `controlId` match preferred over title match)
- If the control ID contains a space (e.g., `/control access control`), it searches by title

---

### `/risks`

**Description:** Shows the current risk summary with a count of findings by severity, and lists the top 5 most critical/high-severity open findings.

**Usage:**
```
/risks
```

**Example Response (Adaptive Card):**

```
⚠️ Risk Summary

Severity Breakdown:
🔴 Critical:  4 findings
🟠 High:      12 findings
🟡 Medium:    23 findings
🟢 Low:        8 findings
ℹ️ Info:       3 findings

─────────────────────────────────────
Top Critical/High Findings:

[CRITICAL] Unencrypted S3 bucket: prod-customer-data
  Source: AWS | Affected: s3://prod-customer-data

[CRITICAL] MFA not enforced for admin accounts
  Source: Azure | Affected: Azure AD

[HIGH] SSL certificate expires in 14 days
  Source: Manual | Affected: api.yourdomain.com

[HIGH] Missing audit logs for database access
  Source: AWS | Affected: RDS prod-db

[HIGH] Outdated dependency: lodash 4.17.19
  Source: GitHub | Affected: compliguard-api

[View All Findings ↗]  [View Risk Dashboard ↗]
```

**Data sources:**
- `findings` table — `severity`, `status`, `title`, `source`, `affectedAsset`
- Filters: `status IN ('open', 'in_remediation')`
- Top 5 = `severity DESC, createdAt ASC` (oldest critical first)

**Notes:**
- Only shows open and in-remediation findings (not resolved/accepted/false_positive)
- If no critical/high findings: shows a "✅ No critical or high risks" message

---

### `/tasks`

**Description:** Shows your overdue and upcoming compliance tasks. Returns tasks assigned to the bot user's organization, prioritized by overdue first, then by due date.

**Usage:**
```
/tasks
```

**Example Response (Adaptive Card):**

```
📋 Your Compliance Tasks

⏰ Overdue (3):

[URGENT] Complete SOC 2 vendor risk assessment
  Status: In Progress | Due: Nov 1 (14 days overdue)
  
[HIGH] Review and sign off on encryption policy
  Status: Todo | Due: Oct 28 (18 days overdue)

[HIGH] Configure CloudTrail in eu-west-1
  Status: In Progress | Due: Oct 30 (16 days overdue)

─────────────────────────────────────
📅 Due This Week (2):

[MEDIUM] Penetration test scheduling
  Status: Todo | Due: Nov 20

[MEDIUM] Update BCDR runbook
  Status: In Progress | Due: Nov 22

[View All Tasks ↗]  [Create Task ↗]
```

**Behavior when no tasks:**
```
✅ No Overdue Tasks

You have no overdue or urgent tasks. 

Upcoming: No tasks due in the next 7 days.

[View All Tasks ↗]
```

**Data sources:**
- `tasks` table — `title`, `status`, `priority`, `dueDate`, `assignedTo`
- Overdue: `dueDate < NOW() AND status NOT IN ('done', 'cancelled')`
- Upcoming: `dueDate BETWEEN NOW() AND NOW() + 7 days AND status NOT IN ('done', 'cancelled')`
- Limit: 5 overdue + 5 upcoming

**Notes:**
- Tasks are org-scoped, not user-scoped (shows all org tasks, not just your own)
- Priority badges: URGENT (red), HIGH (orange), MEDIUM (yellow), LOW (gray)
- Status values: Todo, In Progress, Blocked

---

### `/findings`

**Description:** Shows the 10 most recent open findings sorted by severity (critical first). Includes title, severity badge, source, and affected asset.

**Usage:**
```
/findings
```

**Example Response (Adaptive Card):**

```
🔍 Recent Open Findings (10 of 47 total)

[CRITICAL] Unencrypted S3 bucket: prod-customer-data
  Source: AWS | Asset: s3://prod-customer-data | Created: Nov 1

[CRITICAL] Admin MFA not enforced
  Source: Azure | Asset: Azure AD | Created: Oct 30

[HIGH] SSL certificate expiring soon
  Source: Manual | Asset: api.yourdomain.com | Created: Oct 29

[HIGH] Audit logging gaps in RDS
  Source: AWS | Asset: RDS prod-db | Created: Oct 28

[HIGH] Outdated lodash dependency (CVE-2021-23337)
  Source: GitHub | Asset: compliguard-api | Created: Oct 27

[MEDIUM] Password policy not meeting complexity requirements
  Source: Manual | Asset: Active Directory | Created: Oct 26

[MEDIUM] Missing DLP policy for email
  Source: Azure | Asset: Exchange Online | Created: Oct 25

[MEDIUM] EC2 security group allows unrestricted SSH
  Source: AWS | Asset: i-0abc123 | Created: Oct 24

[LOW] Log retention set to 30 days (policy requires 90)
  Source: AWS | Asset: CloudWatch | Created: Oct 22

[LOW] Developer accounts with prod access
  Source: Manual | Asset: IAM | Created: Oct 20

[View All Findings ↗]  [Triage Findings ↗]
```

**Data sources:**
- `findings` table — all columns
- Filters: `status = 'open'`
- Order: `severity DESC` (critical → high → medium → low → info), then `createdAt DESC`
- Limit: 10

**Notes:**
- Severity color coding: Critical (🔴), High (🟠), Medium (🟡), Low (🟢), Info (ℹ️)
- If fewer than 10 open findings, shows all of them
- If no open findings: shows "✅ No open findings — great work!" message
- `affectedAsset` shown if available, otherwise `resourceId`, otherwise "N/A"

---

### `/policy`

**Description:** Shows policy-related controls and any open findings related to policies. Since CompliGuard manages policies through the controls framework, this command surfaces controls in the "Policy" category and any findings with "policy" in the title or description.

**Usage:**
```
/policy
```

**Example Response (Adaptive Card):**

```
📄 Policy Status

Policy-Related Controls (8 total):

Framework     | Control    | Title                           | Status
--------------+------------+---------------------------------+----------
NIST 800-53   | AC-1       | Access Control Policy           | ✅ Implemented
NIST 800-53   | AT-1       | Awareness Training Policy       | 🔄 In Progress
ISO 27001     | A.5.1      | Information Security Policies   | ✅ Implemented
SOC 2         | CC1.1      | Security Policies               | ⏸ Not Started
ISO 27001     | A.9.1      | Access Control Policy           | 🔄 In Progress
NIST 800-53   | CP-1       | Contingency Planning Policy     | ✅ Implemented
NIST 800-53   | IR-1       | Incident Response Policy        | ⚠️ Needs Review
NIST 800-53   | PL-1       | Planning Policy                 | ✅ Implemented

─────────────────────────────────────
Policy-Related Findings (2 open):

[HIGH] Password policy does not meet complexity requirements
  Source: Manual | Created: Oct 28

[MEDIUM] Data retention policy not documented
  Source: Manual | Created: Oct 15

[View Policies ↗]  [View Controls ↗]
```

**Behavior when no policy items found:**
```
📄 Policy Status

No policy-related controls or findings found.

To track policy compliance, assign controls to your team
in the Controls section of CompliGuard.

[View Controls ↗]
```

**Data sources:**
- `controls` table — `category ILIKE '%policy%' OR title ILIKE '%policy%'`
- `control_assignments` — for status of each control
- `findings` — `title ILIKE '%policy%' AND status = 'open'`
- `frameworks` — for framework name display

**Notes:**
- Policy controls are identified by category containing "policy" or control title containing "policy"
- Status icons: ✅ Implemented, 🔄 In Progress, ⏸ Not Started, ⚠️ Needs Review, 🚫 Not Applicable

---

### `/help`

**Description:** Shows all available bot commands with descriptions and usage examples.

**Usage:**
```
/help
help
```

**Example Response (Adaptive Card):**

```
🛡️ CompliGuard Bot — Available Commands

/compliance
  Show overall compliance score and per-framework breakdown
  Example: /compliance

/control <id>
  Look up a specific control by ID or name
  Example: /control AC-1
  Example: /control access control policy

/risks
  Show current risk summary with critical and high findings
  Example: /risks

/tasks
  Show overdue and upcoming compliance tasks
  Example: /tasks

/findings
  Show the 10 most recent open findings
  Example: /findings

/policy
  Show policy-related controls and findings
  Example: /policy

/help
  Show this help message
  Example: /help

─────────────────────────────────────
You will also receive automatic notifications for:
• New compliance findings (critical/high severity)
• Compliance score drops
• New incidents
• Overdue task reminders

[Open CompliGuard ↗]
```

**Notes:**
- The `/help` command (and the word `help` alone) always responds, even if the org context cannot be determined
- No database queries are made for `/help`

---

## Unknown Command Behavior

When the bot receives an unrecognized message, it responds with a helpful suggestion:

**Example input:** `check my compliance`

**Response:**
```
🤔 Unknown Command

I didn't recognize: "check my compliance"

Did you mean one of these?

• /compliance — Show compliance score
• /findings — Show open findings
• /help — Show all commands

Type /help to see all available commands.

[Open CompliGuard ↗]
```

The bot uses simple keyword matching (e.g., "compliance" → `/compliance`, "finding" → `/findings`, "risk" → `/risks`, "task" → `/tasks`, "policy" → `/policy`, "control" → `/control`) to suggest the most relevant command.

---

## Adaptive Card Action Buttons

Some cards contain action buttons beyond "View" links. These are triggered by clicking buttons in the Adaptive Card:

### Approve / Reject Evidence (Invoke Actions)

When an evidence submission notification is sent proactively, the card may include **Approve** and **Reject** buttons. Clicking these sends an `invoke` activity with `action.submit` to the bot.

**Approve action payload:**
```json
{
  "action": "approve_evidence",
  "evidenceId": "uuid",
  "controlAssignmentId": "uuid"
}
```

**Reject action payload:**
```json
{
  "action": "reject_evidence",
  "evidenceId": "uuid",
  "controlAssignmentId": "uuid",
  "reason": ""
}
```

The bot processes these actions and updates the evidence status in CompliGuard, then replies with a confirmation card.

---

## Notification Types (Proactive)

In addition to commands, the bot proactively sends notifications:

| Notification | Trigger | Severity filter |
|-------------|---------|-----------------|
| New Finding | Finding created | Critical and High only |
| Compliance Alert | Score drops ≥ 5% | Any framework |
| Incident Created | Incident opened | All severities |
| Task Overdue | Task past due date | All priorities |

These notifications are sent to all Teams conversations where the bot is installed and has a saved conversation reference.

---

*For setup instructions, see [teams-bot-setup.md](./teams-bot-setup.md).*  
*CompliGuard v2 — Phase 7*
