import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  soaEntries, controls, frameworks, organizationFrameworks, organizations,
  users,
} from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'

// GET /api/soa/export?frameworkId=xxx
// Returns a print-ready HTML document as the SOA report
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.badRequest('No organisation associated with session')

  const { searchParams } = req.nextUrl
  const frameworkId = searchParams.get('frameworkId')
  if (!frameworkId) return ApiErrors.badRequest('frameworkId is required')

  try {
    // Get org info
    const [org] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, session.orgId))
      .limit(1)

    // Get framework info
    const [fw] = await db
      .select({ name: frameworks.name, shortName: frameworks.shortName, version: frameworks.version })
      .from(frameworks)
      .where(eq(frameworks.id, frameworkId))
      .limit(1)

    if (!fw) return ApiErrors.notFound('Framework')

    // Get all controls
    const frameworkControls = await db
      .select({
        id: controls.id,
        controlId: controls.controlId,
        title: controls.title,
        category: controls.category,
        description: controls.description,
      })
      .from(controls)
      .where(eq(controls.frameworkId, frameworkId))
      .orderBy(controls.controlId)

    // Get SOA entries
    const existingEntries = await db
      .select()
      .from(soaEntries)
      .where(eq(soaEntries.organizationId, session.orgId))

    const entryMap = new Map(existingEntries.map((e) => [e.controlId, e]))

    const today = new Date().toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    // Summary counts
    let included = 0, excluded = 0, partial = 0
    for (const ctrl of frameworkControls) {
      const entry = entryMap.get(ctrl.id)
      const status = entry?.status ?? 'included'
      if (status === 'included') included++
      else if (status === 'excluded') excluded++
      else partial++
    }

    const rows = frameworkControls
      .map((ctrl) => {
        const entry = entryMap.get(ctrl.id)
        const status: string = entry?.status ?? 'included'

        const statusLabel = status === 'included' ? 'Included'
          : status === 'excluded' ? 'Excluded' : 'Partial'

        const statusColor = status === 'included' ? '#10B981'
          : status === 'excluded' ? '#64748B' : '#F59E0B'

        const textDecoration = status === 'excluded' ? 'text-decoration:line-through;opacity:0.6;' : ''

        return `
          <tr>
            <td style="font-family:monospace;font-size:12px;color:#94A3B8;${textDecoration}">${ctrl.controlId ?? ''}</td>
            <td style="${textDecoration}">${escapeHtml(ctrl.title)}</td>
            <td style="color:#94A3B8;${textDecoration}">${escapeHtml(ctrl.category ?? '')}</td>
            <td>
              <span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:${statusColor}">
                <span style="width:7px;height:7px;border-radius:50%;background:${statusColor};display:inline-block;flex-shrink:0"></span>
                ${statusLabel}
              </span>
            </td>
            <td style="font-size:12px;color:#94A3B8">${escapeHtml(entry?.justification ?? '')}</td>
            <td style="font-size:12px;color:#94A3B8">${escapeHtml(entry?.implementationStatus ?? '')}</td>
          </tr>`
      })
      .join('')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Statement of Applicability — ${escapeHtml(fw.shortName ?? fw.name)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #fff;
      color: #1E293B;
      font-size: 13px;
      line-height: 1.5;
      padding: 40px;
    }

    .header {
      margin-bottom: 32px;
      padding-bottom: 20px;
      border-bottom: 2px solid #E2E8F0;
    }

    .header h1 { font-size: 22px; font-weight: 700; color: #0F172A; margin-bottom: 4px; }
    .header .sub { font-size: 13px; color: #64748B; margin-bottom: 16px; }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }

    .meta-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 12px 14px;
    }

    .meta-card .label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #94A3B8; margin-bottom: 3px; }
    .meta-card .value { font-size: 15px; font-weight: 700; color: #1E293B; }

    .summary-bar {
      display: flex;
      gap: 24px;
      padding: 12px 0;
      border-top: 1px solid #E2E8F0;
    }

    .summary-stat { font-size: 12px; color: #64748B; }
    .summary-stat strong { color: #1E293B; margin-right: 4px; }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    thead tr {
      background: #F8FAFC;
    }

    th {
      padding: 9px 12px;
      text-align: left;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748B;
      border-bottom: 2px solid #E2E8F0;
    }

    td {
      padding: 9px 12px;
      border-bottom: 1px solid #F1F5F9;
      color: #1E293B;
      vertical-align: middle;
    }

    tr:nth-child(even) { background: #FAFBFC; }

    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #E2E8F0;
      font-size: 11px;
      color: #94A3B8;
      display: flex;
      justify-content: space-between;
    }

    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Statement of Applicability</h1>
    <div class="sub">${escapeHtml(fw.name)}${fw.version ? ` v${fw.version}` : ''}</div>

    <div class="meta-grid">
      <div class="meta-card">
        <div class="label">Organisation</div>
        <div class="value">${escapeHtml(org?.name ?? 'Unknown')}</div>
      </div>
      <div class="meta-card">
        <div class="label">Framework</div>
        <div class="value">${escapeHtml(fw.shortName ?? fw.name)}</div>
      </div>
      <div class="meta-card">
        <div class="label">Report Date</div>
        <div class="value">${today}</div>
      </div>
    </div>

    <div class="summary-bar">
      <span class="summary-stat"><strong>${included}</strong> Included</span>
      <span class="summary-stat"><strong>${partial}</strong> Partial</span>
      <span class="summary-stat"><strong>${excluded}</strong> Excluded</span>
      <span class="summary-stat"><strong>${frameworkControls.length}</strong> Total Controls</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Control ID</th>
        <th>Title</th>
        <th>Category</th>
        <th>Applicability</th>
        <th>Justification</th>
        <th>Implementation Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="footer">
    <span>Generated by CompliGuard &bull; ${today}</span>
    <span>${escapeHtml(org?.name ?? '')} &bull; Confidential</span>
  </div>

  <script>
    // Auto-open print dialog when the page loads
    window.addEventListener('load', () => window.print());
  </script>
</body>
</html>`

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[soa/export]', err)
    return ApiErrors.internal()
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
