/**
 * app/api/integrations/xdr-relay/route.ts
 * SSE endpoint for real-time Sentinel + Defender incident relay.
 * GET /api/integrations/xdr-relay
 * Streams events every 30 seconds while client is connected.
 * Auth required (session or API key) — NOT in PUBLIC_PATHS.
 */

import { NextRequest } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { getSentinelConfig } from '@/app/api/integrations/sentinel/route'
import { pollSentinelIncidents, pollDefenderAlerts } from '@/lib/microsoft/sentinel-relay'
import { enrichWithMitre } from '@/lib/microsoft/mitre'
import type { SentinelIncident } from '@/lib/microsoft/sentinel'
import type { DefenderAlert } from '@/lib/microsoft/sentinel-relay'

export const dynamic = 'force-dynamic'

const POLL_INTERVAL_MS = 30_000 // 30 seconds
const HEARTBEAT_INTERVAL_MS = 15_000 // 15 seconds

function formatSSE(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

function incidentToEvent(incident: SentinelIncident, isNew: boolean) {
  const tactics = incident.properties?.additionalData?.tactics ?? []
  const mitre = enrichWithMitre(tactics)
  return {
    type: 'incident' as const,
    isNew,
    data: {
      id: incident.name,
      title: incident.properties?.title ?? incident.name,
      severity: incident.properties?.severity ?? 'Medium',
      status: incident.properties?.status ?? 'New',
      tactics,
      assignedTo: incident.properties?.owner?.assignedTo,
      createdAt: incident.properties?.createdTimeUtc,
      lastModifiedAt: incident.properties?.lastModifiedTimeUtc,
      alertProducts: incident.properties?.additionalData?.alertProductNames,
    },
    mitre: mitre.map((m) => ({
      techniqueId: m.techniqueId,
      techniqueName: m.techniqueName,
      tacticName: m.tacticName,
      severity: m.severity,
    })),
    timestamp: new Date().toISOString(),
  }
}

function alertToEvent(alert: DefenderAlert) {
  return {
    type: 'alert' as const,
    data: {
      id: alert.id,
      title: alert.title,
      severity: alert.severity,
      status: alert.status,
      category: alert.category,
      detectionSource: alert.detectionSource,
      createdDateTime: alert.createdDateTime,
      description: alert.description,
    },
    timestamp: new Date().toISOString(),
  }
}

export async function GET(request: NextRequest) {
  // Auth check
  const session = await requireAuth(request)
  if (!session) return ApiErrors.unauthorized()

  const orgId = session.orgId!

  // Check if XDR/Sentinel is configured
  const config = await getSentinelConfig(orgId)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false

      // Heartbeat timer
      const heartbeatTimer = setInterval(() => {
        if (closed) return
        try {
          controller.enqueue(
            encoder.encode(
              formatSSE({ type: 'heartbeat', timestamp: new Date().toISOString() }),
            ),
          )
        } catch {
          closed = true
          clearInterval(heartbeatTimer)
          clearInterval(pollTimer)
        }
      }, HEARTBEAT_INTERVAL_MS)

      // Poll timer
      const pollTimer = setInterval(async () => {
        if (closed) return

        if (!config) {
          // Send a "not-configured" event so the ticker can show the right state
          try {
            controller.enqueue(
              encoder.encode(
                formatSSE({
                  type: 'status',
                  connected: false,
                  message: 'XDR not configured',
                  timestamp: new Date().toISOString(),
                }),
              ),
            )
          } catch {
            closed = true
          }
          return
        }

        try {
          // Poll Sentinel incidents
          const sentinelResult = await pollSentinelIncidents(config, orgId)

          for (const incident of sentinelResult.newIncidents) {
            if (closed) break
            try {
              controller.enqueue(
                encoder.encode(formatSSE(incidentToEvent(incident, true))),
              )
            } catch {
              closed = true
              break
            }
          }

          for (const incident of sentinelResult.updatedIncidents) {
            if (closed) break
            try {
              controller.enqueue(
                encoder.encode(formatSSE(incidentToEvent(incident, false))),
              )
            } catch {
              closed = true
              break
            }
          }

          // Poll Defender alerts
          const defenderResult = await pollDefenderAlerts(config, orgId)

          for (const alert of defenderResult.newAlerts) {
            if (closed) break
            try {
              controller.enqueue(encoder.encode(formatSSE(alertToEvent(alert))))
            } catch {
              closed = true
              break
            }
          }
        } catch {
          // Poll error — send error event but keep stream alive
          try {
            controller.enqueue(
              encoder.encode(
                formatSSE({
                  type: 'error',
                  message: 'Poll failed. Retrying...',
                  timestamp: new Date().toISOString(),
                }),
              ),
            )
          } catch {
            closed = true
          }
        }
      }, POLL_INTERVAL_MS)

      // Initial status event
      try {
        controller.enqueue(
          encoder.encode(
            formatSSE({
              type: 'status',
              connected: !!config,
              message: config ? 'XDR relay connected' : 'XDR not configured',
              timestamp: new Date().toISOString(),
            }),
          ),
        )
      } catch {
        closed = true
      }

      // Listen for client disconnect
      request.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(heartbeatTimer)
        clearInterval(pollTimer)
        try {
          controller.close()
        } catch {
          // Already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
