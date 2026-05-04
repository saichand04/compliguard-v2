# CompliGuard Teams Bot — Azure Bot Service Setup Guide

This guide walks you through the complete process of registering, configuring, and installing the CompliGuard Teams Bot in your Microsoft Teams tenant. Estimated time: 30–45 minutes.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Create an App Registration in Azure AD](#2-create-an-app-registration-in-azure-ad)
3. [Create the Azure Bot Service](#3-create-the-azure-bot-service)
4. [Enable the Microsoft Teams Channel](#4-enable-the-microsoft-teams-channel)
5. [Configure CompliGuard](#5-configure-compliguard)
6. [Update the Teams App Manifest](#6-update-the-teams-app-manifest)
7. [Install the Bot in Microsoft Teams](#7-install-the-bot-in-microsoft-teams)
8. [Verify the Installation](#8-verify-the-installation)
9. [Environment Variables Reference](#9-environment-variables-reference)
10. [Troubleshooting](#10-troubleshooting)
11. [Security Considerations](#11-security-considerations)
12. [Updating the Bot](#12-updating-the-bot)

---

## 1. Prerequisites

Before you begin, ensure you have the following:

### Azure Requirements
- **Azure subscription** with at least Contributor rights on a resource group
  - If you don't have a subscription, create one at [https://portal.azure.com](https://portal.azure.com)
  - Free tier includes enough to run the Bot Service for development/testing
- **Azure Active Directory (Azure AD) / Entra ID** access
  - You need permission to create App Registrations
  - If your tenant has restricted app registrations, contact your Azure AD administrator
  - Required role: **Application Administrator** or **Global Administrator**

### Teams Requirements
- **Microsoft Teams administrator access**
  - Access to Teams Admin Center: [https://admin.teams.microsoft.com](https://admin.teams.microsoft.com)
  - Role required: **Teams Administrator** or **Global Administrator**
- **Teams Developer Portal access** (optional, for testing)
  - Available at [https://dev.teams.microsoft.com](https://dev.teams.microsoft.com)

### CompliGuard Requirements
- A running CompliGuard v2 instance accessible via a public HTTPS URL
  - Local development: use [ngrok](https://ngrok.com) or [Cloudflare Tunnel](https://www.cloudflare.com/products/tunnel/) to expose your local server
  - Production: your deployed domain (e.g., `https://compliance.yourdomain.com`)
- Access to CompliGuard's Settings → Integrations page
- Administrator role in CompliGuard

### Tools You Will Need
- A web browser (Chrome or Edge recommended for Azure Portal)
- A text editor to temporarily store IDs and secrets
- Access to your CompliGuard server's environment variables (`.env.local` or deployment config)

---

## 2. Create an App Registration in Azure AD

The App Registration creates the identity (client ID + secret) that the bot uses to authenticate with the Microsoft Bot Framework and Microsoft Graph.

### 2.1 Navigate to App Registrations

1. Open [Azure Portal](https://portal.azure.com) and sign in with your Azure administrator account.
2. In the top search bar, type **"Azure Active Directory"** and click the result.
   > _[Screenshot placeholder: Azure Portal home with search bar highlighting "Azure Active Directory"]_
3. In the left sidebar, click **App registrations**.
4. You will see a list of existing registrations (if any).

### 2.2 Create a New Registration

1. Click **+ New registration** at the top of the page.
   > _[Screenshot placeholder: App registrations list page with "+ New registration" button highlighted]_

2. Fill in the registration form:

   | Field | Value |
   |-------|-------|
   | **Name** | `CompliGuard Bot` |
   | **Supported account types** | `Accounts in this organizational directory only (Single tenant)` |
   | **Redirect URI** | Leave blank (not needed for bot flow) |

   > **Why single tenant?** For a private corporate bot, single-tenant is more secure. If you need to distribute this bot to other organizations, choose "Multitenant" — but this requires additional configuration.

3. Click **Register**.
   > _[Screenshot placeholder: New registration form with fields filled in]_

### 2.3 Copy the Application (Client) ID

After registration completes, you will be on the app's overview page.

1. Locate the **Application (client) ID** field — it will look like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
2. Copy this value and save it somewhere safe. You will need it in Step 5.
   - This is your **BOT_APP_ID** / `MicrosoftAppId`

   > _[Screenshot placeholder: App overview page with "Application (client) ID" highlighted]_

3. Also copy the **Directory (tenant) ID** — you will need this too.
   - This is your **BOT_TENANT_ID** / `MicrosoftAppTenantId`

### 2.4 Create a Client Secret

The client secret is the "password" the bot uses to authenticate. **You can only view it once**, so copy it immediately.

1. In the left sidebar, click **Certificates & secrets**.
2. Click **+ New client secret**.
   > _[Screenshot placeholder: Certificates & secrets page with "+ New client secret" highlighted]_

3. In the panel that appears:
   - **Description**: `CompliGuard Bot Production` (or `Development` for dev environments)
   - **Expires**: Select `24 months` for production (and rotate before expiry)

4. Click **Add**.

5. **IMMEDIATELY** copy the **Value** column (not the Secret ID). It will look like a long random string.
   - This is your **BOT_APP_PASSWORD** / `MicrosoftAppPassword`
   - ⚠️ Once you navigate away from this page, the value is hidden forever. If you lose it, you must create a new secret.

   > _[Screenshot placeholder: New client secret showing the Value column to copy]_

6. Store this value securely (e.g., in a password manager or Azure Key Vault).

### 2.5 (Optional) Configure API Permissions

For the basic bot functionality, no additional API permissions are required beyond the default. If you plan to use Microsoft Graph features (e.g., reading user profiles), add permissions later. For now, proceed to Step 3.

---

## 3. Create the Azure Bot Service

The Azure Bot Service acts as the messaging broker between Microsoft Teams and your CompliGuard webhook endpoint.

### 3.1 Search for Azure Bot in the Marketplace

1. In the Azure Portal, click **+ Create a resource** (or use the top search bar).
2. Search for **"Azure Bot"** in the search box.
3. Click the **Azure Bot** card published by Microsoft.
   > _[Screenshot placeholder: Azure Marketplace showing the Azure Bot card]_

4. Click **Create**.

### 3.2 Fill in the Bot Configuration Form

On the "Create an Azure Bot" form:

**Basics tab:**

| Field | Value |
|-------|-------|
| **Bot handle** | `compliguard-bot` (must be globally unique; try adding your org abbreviation, e.g. `compliguard-acme-bot`) |
| **Subscription** | Select your Azure subscription |
| **Resource group** | Create new or use existing (e.g., `rg-compliguard-prod`) |
| **Location** | Select the region closest to your users (e.g., `East US`, `West Europe`) |
| **Pricing tier** | `F0` (Free, up to 10,000 messages/month) or `S1` (Standard, for production) |

**Microsoft App ID section:**

| Field | Value |
|-------|-------|
| **Type of App** | `Single Tenant` |
| **Creation type** | `Use existing app registration` |
| **Existing App ID** | Paste the **Application (client) ID** from Step 2.3 |

> _[Screenshot placeholder: Azure Bot creation form with all fields filled in]_

### 3.3 Set the Messaging Endpoint

1. After the bot is created, navigate to the **Configuration** blade (left sidebar).
2. In the **Messaging endpoint** field, enter:
   ```
   https://YOUR_DOMAIN/api/teams/bot
   ```
   Replace `YOUR_DOMAIN` with your actual domain, e.g.:
   - Production: `https://compliance.yourdomain.com/api/teams/bot`
   - Local dev (ngrok): `https://abc123.ngrok.io/api/teams/bot`

3. Click **Apply** to save.

   > _[Screenshot placeholder: Bot Configuration page with messaging endpoint filled in]_

### 3.4 Verify the App Password is Set

1. Still in the **Configuration** blade, scroll to the **App password** section.
2. If it shows "(Managed by Azure)" leave it. If it shows blank, click **Manage Password** and add the secret from Step 2.4.

---

## 4. Enable the Microsoft Teams Channel

By default the bot only has the Direct Line channel. You need to add the Teams channel.

### 4.1 Open Channels Configuration

1. In your Azure Bot resource, click **Channels** in the left sidebar.
   > _[Screenshot placeholder: Azure Bot left sidebar with "Channels" highlighted]_

2. You will see a list of available channels (Teams, Web Chat, Direct Line, etc.)

### 4.2 Add the Microsoft Teams Channel

1. Click on the **Microsoft Teams** channel icon/tile.
2. Read and accept the **Microsoft Channel Publication Terms** (click the checkbox).
3. Click **Agree** and then **Save**.
   > _[Screenshot placeholder: Teams channel configuration page with "Save" button]_

4. The Teams channel should now appear in your connected channels list with a green status.

### 4.3 (Optional) Teams Channel Settings

After enabling Teams, click the pencil (edit) icon next to the Teams channel to access advanced settings:

- **Enable calling**: Leave unchecked (CompliGuard doesn't use voice)
- **Messaging**: Enabled by default — leave as-is

---

## 5. Configure CompliGuard

Now you'll enter the Azure credentials into CompliGuard so the bot can send proactive notifications.

### 5.1 Via Environment Variables (Recommended)

Add the following variables to your CompliGuard environment (`.env.local` for development, or your deployment platform's secrets manager):

```bash
# Azure Bot Service credentials
BOT_APP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx    # Application (client) ID from Step 2.3
BOT_APP_PASSWORD=your-client-secret-value            # Client secret from Step 2.4
BOT_TENANT_ID=yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy   # Directory (tenant) ID from Step 2.3

# Public URL of your CompliGuard instance (used in card action URLs)
NEXT_PUBLIC_APP_URL=https://compliance.yourdomain.com
```

Restart your CompliGuard server after adding these variables.

### 5.2 Verify Environment Variables are Loaded

You can verify the bot credentials are loaded by checking the server logs when a bot activity is received. Look for lines starting with `[Teams Bot]`.

If `BOT_APP_ID` or `BOT_APP_PASSWORD` are missing, the bot will:
- Skip proactive notification sending (the token fetch will fail)
- Still respond to incoming messages (the webhook endpoint itself doesn't need credentials to receive)

---

## 6. Update the Teams App Manifest

The manifest is the package that defines your Teams app. It lives at `public/teams-manifest/manifest.json`.

### 6.1 Edit the Manifest File

Open `public/teams-manifest/manifest.json` and update the following fields:

```json
{
  "id": "YOUR_BOT_APP_ID",           // Replace {{BOT_APP_ID}} with actual GUID from Step 2.3
  "developer": {
    "name": "Your Company Name",
    "websiteUrl": "https://compliance.yourdomain.com",
    "privacyUrl": "https://compliance.yourdomain.com/privacy",
    "termsOfUseUrl": "https://compliance.yourdomain.com/terms"
  },
  "bots": [
    {
      "botId": "YOUR_BOT_APP_ID"     // Same GUID as above
    }
  ],
  "validDomains": ["compliance.yourdomain.com"]
}
```

### 6.2 Add Bot Icons

The manifest requires two icon files in `public/teams-manifest/`:
- `icon-color.png`: 192×192 px, full-color app icon
- `icon-outline.png`: 32×32 px, white/transparent outline icon

You can use any image editing tool to create these. Teams enforces exact dimensions.

### 6.3 Package the Manifest

Create a ZIP file containing these three files (not a folder — the files must be at the root of the ZIP):

```bash
cd public/teams-manifest
zip compliguard-teams-app.zip manifest.json icon-color.png icon-outline.png
```

This ZIP is your **Teams app package**.

---

## 7. Install the Bot in Microsoft Teams

There are two methods to install the app:

### Method A: Teams Admin Center (Recommended for Production)

This method makes the app available to your entire organization.

1. Go to [Teams Admin Center](https://admin.teams.microsoft.com) and sign in.
2. In the left sidebar, navigate to **Teams apps → Manage apps**.
3. Click **+ Upload new app** (top right).
   > _[Screenshot placeholder: Teams Admin Center "Manage apps" page with upload button]_

4. Select the `compliguard-teams-app.zip` file you created in Step 6.3.

5. The app will appear in the list. Click on it to configure:
   - **Status**: Set to `Allowed`
   - **Org-wide app settings**: Optionally pin it for all users

6. To push the app to specific users or teams:
   - Go to **Teams apps → Setup policies**
   - Create a new policy or edit the global policy
   - Under **Installed apps**, add CompliGuard
   - Assign the policy to the target users/groups

### Method B: Developer Portal (For Development/Testing)

1. Go to [Teams Developer Portal](https://dev.teams.microsoft.com).
2. Click **Apps** in the left sidebar.
3. Click **Import app** and upload `compliguard-teams-app.zip`.
   > _[Screenshot placeholder: Developer Portal "Apps" page with import option]_

4. Once imported, click **Preview in Teams** to install it directly into your personal Teams client for testing.

### Method C: Sideloading (For Individual Testing)

If your Teams tenant allows sideloading custom apps:

1. Open Microsoft Teams.
2. Click **Apps** in the left sidebar.
3. Click **Manage your apps** → **Upload an app**.
4. Select **Upload a custom app** and choose `compliguard-teams-app.zip`.

> **Note:** Sideloading must be enabled in Teams Admin Center under **Teams apps → Setup policies → Allow uploading custom apps**.

---

## 8. Verify the Installation

### 8.1 Start a Conversation with the Bot

1. In Microsoft Teams, click the **Chat** icon in the sidebar.
2. Click **New chat** (pencil icon).
3. In the search box, type **CompliGuard** and select the CompliGuard GRC Bot.
4. Press **Enter** to open a conversation.

### 8.2 Test with /help

Type `/help` in the message box and press Enter.

**Expected response:** An Adaptive Card showing all available commands:
- `/compliance` — Show overall compliance score
- `/control <id>` — Look up a specific control
- `/risks` — Show current risk summary
- `/tasks` — Show overdue and upcoming tasks
- `/findings` — Show recent open findings
- `/policy` — Show policy status
- `/help` — Show all commands

### 8.3 Test the Welcome Card

To trigger the welcome card again (e.g., for testing):
1. Remove the bot from the conversation
2. Add it back

The bot should send a welcome Adaptive Card with quick-start action buttons.

### 8.4 Verify Proactive Notifications

To confirm that proactive notifications work:
1. In CompliGuard, create a test finding with severity = `critical`
2. Check your Teams conversation — within a few seconds (or when the notification is triggered), you should receive a Finding card

### 8.5 Check Server Logs

On your CompliGuard server, monitor logs for:
```
[Teams Bot] Received activity: conversationUpdate
[Teams Bot] Saved conversation ref: <conversationId>
[Teams Bot] Received activity: message, text: /help
```

If you see errors like `Failed to obtain bot token`, check that `BOT_APP_ID`, `BOT_APP_PASSWORD`, and `BOT_TENANT_ID` are set correctly.

---

## 9. Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `BOT_APP_ID` | Yes | Azure AD Application (client) ID | `12345678-abcd-...` |
| `BOT_APP_PASSWORD` | Yes | Azure AD client secret value | `abc123~xyz...` |
| `BOT_TENANT_ID` | Yes (single-tenant) | Azure AD Directory (tenant) ID | `87654321-dcba-...` |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of CompliGuard instance | `https://compliance.yourdomain.com` |

### Where to Set These

**Local development** (`.env.local`):
```bash
BOT_APP_ID=your-app-id
BOT_APP_PASSWORD=your-secret
BOT_TENANT_ID=your-tenant-id
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Vercel**: Dashboard → Project → Settings → Environment Variables

**Azure App Service**: Configuration → Application settings

**Docker**: Pass as `--env` flags or in `docker-compose.yml` under `environment:`

---

## 10. Troubleshooting

### Bot does not respond to messages

**Check:**
1. Is the messaging endpoint URL correct and publicly accessible?
2. Does `https://YOUR_DOMAIN/api/teams/bot` return 200 when the bot sends an activity?
3. Is the bot channel showing as "Running" in Azure Portal → Channels?
4. Try the Bot Framework Emulator to test locally: [https://github.com/microsoft/BotFramework-Emulator](https://github.com/microsoft/BotFramework-Emulator)

**Common fix:** The messaging endpoint must be HTTPS (not HTTP) in production. For local dev, use ngrok or Cloudflare Tunnel.

### Welcome card not sent when bot is added

**Check:**
1. In Azure Portal → Channels, verify Teams channel is enabled.
2. The `conversationUpdate` activity with `membersAdded` must reach your endpoint.
3. Check server logs for `[Teams Bot] Failed to send welcome card:` errors.
4. Verify `BOT_APP_PASSWORD` is correct — the token fetch may be failing silently.

### "Unauthorized" error in bot webhook logs

**Check:**
1. The `/api/teams/bot` route must be in `PUBLIC_PATHS` in `proxy.ts` — this is a webhook, not a user-authenticated route.
2. The `Authorization: Bearer <token>` header from Bot Framework must be present.
3. If `BOT_APP_PASSWORD` is set, the route validates the Bearer token.

### Bot token fetch fails: `401 Unauthorized`

**Check:**
1. The client secret (`BOT_APP_PASSWORD`) may have expired — check Azure AD → App Registrations → Certificates & secrets.
2. The `BOT_APP_ID` must match exactly the Application (client) ID used to create the secret.
3. If using single-tenant mode, `BOT_TENANT_ID` must be set to the correct tenant.

### Adaptive cards not rendering

**Check:**
1. The card version (`"version": "1.4"`) must be supported by the Teams client version.
2. Teams Desktop supports up to Adaptive Card 1.5; Teams Web supports 1.4.
3. Use the [Adaptive Card Designer](https://adaptivecards.io/designer/) to preview your card before sending.

### DB error: foreign key constraint on organization_id

The bot webhook receives activities without a user session. When saving a new `teamsConversationRef`, the `organizationId` cannot be inferred automatically.

**Solution:** Your Azure AD tenant ID can be mapped to an organization in CompliGuard. Configure the `BOT_TENANT_ID` variable and ensure a corresponding organization record exists with a matching `teamstenantid` field, or use the placeholder `00000000-0000-0000-0000-000000000000` for personal/group chats that aren't tied to a specific org.

---

## 11. Security Considerations

### Bot Endpoint Security

The `/api/teams/bot` endpoint is a public webhook — it does not use session-based authentication. Instead, it relies on:

1. **Bot Framework JWT verification**: The Bot Framework sends a signed JWT Bearer token with each activity. In production, your server should validate this token against Microsoft's OpenID Connect metadata endpoint.

2. **HMAC validation (alternative)**: Some implementations use HMAC-SHA256 of the request body signed with `BOT_APP_PASSWORD`. CompliGuard's current implementation accepts any valid Bearer token when `BOT_APP_PASSWORD` is set.

3. **HTTPS only**: Never run the bot endpoint over plain HTTP in production. All Bot Framework traffic must use TLS.

### Client Secret Rotation

Azure AD client secrets expire. Set a reminder to rotate your secret before it expires:
1. Create a new secret in Azure AD (don't delete the old one yet)
2. Update `BOT_APP_PASSWORD` in your deployment
3. Redeploy / restart CompliGuard
4. Verify the bot still works
5. Delete the old secret in Azure AD

### Least-Privilege Permissions

The App Registration should only have:
- Default Microsoft Graph `User.Read` (added automatically)
- No additional permissions unless you add Microsoft Graph features later

The bot does NOT require access to users' emails, calendars, or files.

### Teams Admin Center Policies

Limit which users can interact with the bot using Teams App Permission Policies:
1. Teams Admin Center → Teams apps → Permission policies
2. Create a policy allowing only CompliGuard
3. Assign to security/compliance team members

---

## 12. Updating the Bot

### Updating the Manifest Version

When you add new commands or change bot capabilities:
1. Increment the `version` field in `manifest.json` (e.g., `1.0.0` → `1.1.0`)
2. Repackage the ZIP
3. In Teams Admin Center → Manage apps, click on CompliGuard → **Upload file** to upload the updated package
4. Teams automatically pushes the update to all users

### Updating the Messaging Endpoint

If your domain changes:
1. Azure Portal → Your Azure Bot → Configuration
2. Update the **Messaging endpoint** URL
3. Click **Apply**

No Teams reinstallation is required — only the Azure Bot config needs updating.

### Rotating the Client Secret

See Section 11 (Client Secret Rotation) above.

---

## Appendix A: Bot Framework Architecture

```
Teams Client
    │
    │  HTTPS POST (activity JSON)
    ▼
Azure Bot Service
    │
    │  Forwards to messaging endpoint
    │  with Bot Framework JWT token
    ▼
CompliGuard /api/teams/bot
    │
    ├─ conversationUpdate → save ref, send welcome card
    ├─ message → command dispatcher → DB query → adaptive card
    └─ invoke → handle action.submit (approve/reject)
    │
    │  POST reply activity to serviceUrl
    ▼
Azure Bot Service → Teams Client
```

---

## Appendix B: Testing with Bot Framework Emulator

For local development without a public URL:

1. Download [Bot Framework Emulator](https://github.com/microsoft/BotFramework-Emulator/releases)
2. Start CompliGuard locally: `npm run dev`
3. Open the Emulator and connect to: `http://localhost:3000/api/teams/bot`
4. Set **Microsoft App ID** and **Microsoft App Password** to your dev credentials (or leave blank for dev mode)
5. Send messages to test your bot locally

> **Note:** Emulator activities look slightly different from real Teams activities. Some Teams-specific properties (`channelData.tenant`, `channelId: "msteams"`) may be absent.

---

## Appendix C: ngrok Setup for Local Development

To expose your local CompliGuard to the internet for Teams bot testing:

```bash
# Install ngrok
npm install -g ngrok

# Expose port 3000
ngrok http 3000
```

Copy the `https://` URL (e.g., `https://abc123.ngrok.io`) and:
1. Set it as the messaging endpoint in Azure Portal → Your Bot → Configuration
2. Set `NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io` in your `.env.local`

> **Note:** The free ngrok URL changes every time you restart ngrok. Consider [ngrok's paid plan](https://ngrok.com/pricing) for a stable URL during development.

---

*Last updated: Phase 7 — CompliGuard v2*
*For support, open an issue in the CompliGuard repository.*
