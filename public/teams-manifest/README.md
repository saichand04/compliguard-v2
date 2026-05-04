# CompliGuard Teams Bot — Manifest & Sideloading Guide

This directory contains the Microsoft Teams app manifest for the CompliGuard GRC Bot.

## Prerequisites

- Microsoft Teams admin access or developer sideloading enabled
- Azure Bot registration completed (see Settings → Teams Bot in CompliGuard)
- Your CompliGuard instance accessible at a public HTTPS URL

## Step 1 — Prepare the manifest

Replace the `{{BOT_APP_ID}}` placeholder in `manifest.json` with your actual Azure AD Application (client) ID:

```bash
sed 's/{{BOT_APP_ID}}/YOUR-APP-ID-HERE/g' manifest.json > manifest-production.json
```

Replace `your-domain.com` in `validDomains` and the developer URLs with your actual domain.

## Step 2 — Add bot icons

Place two icon files in this directory:

| File | Size | Notes |
|------|------|-------|
| `icon-color.png` | 192×192 px | Full-colour icon (used in channel header) |
| `icon-outline.png` | 32×32 px | White outline on transparent background (used in sidebar) |

You can use the CompliGuard shield icon as the source. Both must be PNG.

## Step 3 — Create the app package

The Teams app package is a ZIP file containing:
- `manifest.json` (with substituted values)
- `icon-color.png`
- `icon-outline.png`

```bash
# From this directory (after substituting BOT_APP_ID):
zip compliguard-teams-bot.zip manifest.json icon-color.png icon-outline.png
```

## Step 4 — Sideload the bot

### Option A — Teams Developer Portal (Recommended)

1. Go to [https://dev.teams.microsoft.com/](https://dev.teams.microsoft.com/)
2. Select **Apps** → **Import app**
3. Upload `compliguard-teams-bot.zip`
4. Click **Publish** → **Publish to your org**

### Option B — Teams Admin Center

1. Go to [https://admin.teams.microsoft.com/](https://admin.teams.microsoft.com/)
2. Navigate to **Teams apps** → **Manage apps**
3. Click **Upload new app** and select `compliguard-teams-bot.zip`
4. After upload, create an **App permission policy** to allow the app for your org

### Option C — Direct sideload (personal use / testing)

1. Open Microsoft Teams desktop or web app
2. Click **Apps** in the left sidebar → **Manage your apps**
3. Click **Upload an app** → **Upload a custom app**
4. Select `compliguard-teams-bot.zip`

> Note: Direct sideloading requires the **Upload custom apps** permission in your tenant's Teams policy.

## Step 5 — Install in a channel

1. After publishing, go to a Teams channel where you want compliance alerts
2. Click **+** (Add a tab) → search for **CompliGuard**
3. Add the bot to the channel

Alternatively, add it via **Messaging extensions** or search for "CompliGuard" in the Teams app store (if published org-wide).

## Webhook URL

The bot webhook endpoint is:

```
https://your-domain.com/api/teams/bot
```

Ensure this is set as the **Messaging Endpoint** in your Azure Bot Channel Registration.

## Environment Variables

Set these in your CompliGuard deployment:

| Variable | Description |
|----------|-------------|
| `BOT_APP_ID` | Azure AD Application (client) ID |
| `BOT_APP_PASSWORD` | Azure AD client secret |
| `NEXT_PUBLIC_APP_URL` | Public URL of your CompliGuard instance |

## Testing

After installation, send `/help` to the bot in Teams to verify it's responding. You can also use the **Test Connection** button in CompliGuard → Settings → Teams Bot to send a test proactive message.
