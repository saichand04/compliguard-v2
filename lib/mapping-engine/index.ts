/**
 * CompliGuard v2 — Mapping Engine
 *
 * Central orchestrator for the Controls Mapping Engine.
 * Resolves canonical NIST 800-53 Rev 5 anchors, cross-framework mappings,
 * evidence inheritance chains, and AI-suggested mappings.
 *
 * Architecture:
 *   1. Canonical Store  — NIST 800-53 Rev 5 as the universal anchor
 *   2. Mapping Graph    — control_mappings table with bidirectional edges
 *   3. Evidence Inheritance — auto-propagate evidence across mapped controls
 *   4. AI Engine        — placeholder hooks for future AI-suggested mappings
 */

import { db } from '@/lib/db'
import {
  controls,
  controlMappings,
  frameworks,
} from '@/lib/db/schema/frameworks'
import {
  canonicalControls,
  mappingRules,
  evidenceInheritance,
  mappingSuggestions,
  type CanonicalControl,
  type MappingRule,
} from '@/lib/db/schema/mapping_engine'
import { systemSettings } from '@/lib/db/schema/system_settings'
import { eq, or, and, inArray } from 'drizzle-orm'
import { decodeHitrustId, normalizeToCanonical, isHitrustId } from './hitrust-decoder'
import { lookupByScfId, lookupByNistFamily, SCF_CROSSWALK } from './scf-crosswalk'
import { normalizeFrameworkUpload, detectFramework, type NormalizedControl } from './framework-normalizer'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MappedControl {
  controlId: string
  frameworkId: string
  frameworkName: string
  frameworkSlug: string | null
  controlTitle: string
  controlRef: string | null
  mappingType: 'direct' | 'partial' | 'related' | 'inferred'
  confidence: number
  source: 'builtin' | 'scf' | 'ai' | 'user'
  canonicalNistId: string | null
  isUserOverride: boolean
}

export interface MappingSuggestionResult {
  targetControlId: string
  targetFramework: string
  targetControlRef: string | null
  targetTitle: string
  confidence: number
  rationale: string
  suggestedBy: 'ai' | 'scf'
}

export interface EvidenceInheritanceChain {
  controlId: string
  controlRef: string | null
  frameworkId: string
  frameworkName: string
  inheritanceDepth: number
}

export interface ResolvedCanonical {
  nistId: string | null
  family: string | null
  title: string | null
  confidence: number
  resolvedVia: 'direct' | 'mapping_rule' | 'hitrust_decode' | 'none'
}

// ── MappingEngine class ───────────────────────────────────────────────────────

export class MappingEngine {
  /**
   * Resolve a control's canonical NIST 800-53 Rev 5 ID.
   * Resolution order:
   *   1. Check mapping_rules for a direct frameworkControlId match
   *   2. For HITRUST: decode domain → NIST family hint
   *   3. SCF crosswalk lookup
   *   4. Return null if unresolvable
   */
  async resolveCanonical(
    frameworkSlug: string,
    controlId: string
  ): Promise<ResolvedCanonical> {
    const normalizedId = this.normalizeControlId(frameworkSlug, controlId)

    // 1. Check mapping_rules table
    const rules = await db
      .select()
      .from(mappingRules)
      .where(eq(mappingRules.frameworkControlId, normalizedId))
      .limit(5)

    if (rules.length > 0) {
      // Prefer user overrides, then scf, then others
      const best =
        rules.find((r) => r.isOverride) ??
        rules.find((r) => r.source === 'scf') ??
        rules[0]

      return {
        nistId: best.nistId,
        family: best.nistId.split('-')[0] ?? null,
        title: null,
        confidence: best.confidence ?? 80,
        resolvedVia: 'mapping_rule',
      }
    }

    // 2. HITRUST-specific: decode domain to get NIST family
    if (frameworkSlug === 'hitrust' || isHitrustId(controlId)) {
      const hint = normalizeToCanonical(controlId)
      if (hint) {
        return {
          nistId: null,
          family: hint.nistFamily,
          title: null,
          confidence: 50,
          resolvedVia: 'hitrust_decode',
        }
      }
    }

    return {
      nistId: null,
      family: null,
      title: null,
      confidence: 0,
      resolvedVia: 'none',
    }
  }

  /**
   * Get all cross-framework mappings for a control.
   * Traverses the control_mappings bidirectional graph.
   */
  async getCrossFrameworkMappings(controlId: string): Promise<MappedControl[]> {
    // Find all mappings where this control is source or target
    const mappings = await db
      .select({
        mapping: controlMappings,
        sourceControl: controls,
        targetControl: controls,
      })
      .from(controlMappings)
      .where(
        or(
          eq(controlMappings.sourceControlId, controlId),
          eq(controlMappings.targetControlId, controlId)
        )
      )
      .limit(100)

    if (mappings.length === 0) return []

    // Collect all related control IDs (the "other side" of each mapping)
    const relatedControlIds = mappings.map((m) =>
      m.mapping.sourceControlId === controlId
        ? m.mapping.targetControlId
        : m.mapping.sourceControlId
    )

    // Fetch control + framework details for related controls
    const relatedControls = await db
      .select({
        control: controls,
        framework: frameworks,
      })
      .from(controls)
      .innerJoin(frameworks, eq(controls.frameworkId, frameworks.id))
      .where(inArray(controls.id, relatedControlIds))

    const controlMap = new Map(relatedControls.map((r) => [r.control.id, r]))

    return mappings
      .map((m) => {
        const otherId =
          m.mapping.sourceControlId === controlId
            ? m.mapping.targetControlId
            : m.mapping.sourceControlId

        const related = controlMap.get(otherId)
        if (!related) return null

        return {
          controlId: related.control.id,
          frameworkId: related.framework.id,
          frameworkName: related.framework.name,
          frameworkSlug: related.framework.slug,
          controlTitle: related.control.title,
          controlRef: related.control.controlId,
          mappingType: (m.mapping.mappingType ?? 'direct') as MappedControl['mappingType'],
          confidence: m.mapping.confidence ?? 0,
          source: (m.mapping.source ?? 'builtin') as MappedControl['source'],
          canonicalNistId: m.mapping.canonicalNistId ?? null,
          isUserOverride: m.mapping.isUserOverride ?? false,
        } satisfies MappedControl
      })
      .filter((m): m is MappedControl => m !== null)
  }

  /**
   * Get the evidence inheritance chain for an evidence item.
   * Returns all controls that should receive the evidence via mapping inheritance.
   */
  async getEvidenceInheritanceChain(
    evidenceId: string
  ): Promise<EvidenceInheritanceChain[]> {
    const inheritances = await db
      .select({
        inheritance: evidenceInheritance,
        control: controls,
        framework: frameworks,
      })
      .from(evidenceInheritance)
      .innerJoin(controls, eq(controls.id, evidenceInheritance.inheritedControlId))
      .innerJoin(frameworks, eq(frameworks.id, controls.frameworkId))
      .where(
        and(
          eq(evidenceInheritance.evidenceId, evidenceId),
          eq(evidenceInheritance.isActive, true)
        )
      )
      .limit(200)

    return inheritances.map((row) => ({
      controlId: row.control.id,
      controlRef: row.control.controlId,
      frameworkId: row.framework.id,
      frameworkName: row.framework.name,
      inheritanceDepth: row.inheritance.inheritanceDepth ?? 1,
    }))
  }

  /**
   * Suggest mappings for a control using SCF crosswalk and AI engine.
   * Returns MappingSuggestionResult[] sorted by confidence descending.
   * Also sets `this._lastAiConfigRequired` if AI is not configured.
   */
  async suggestMappings(controlId: string): Promise<MappingSuggestionResult[]> {
    // Get the control and its framework
    const [controlRow] = await db
      .select({ control: controls, framework: frameworks })
      .from(controls)
      .innerJoin(frameworks, eq(controls.frameworkId, frameworks.id))
      .where(eq(controls.id, controlId))
      .limit(1)

    if (!controlRow) return []

    const rawId = controlRow.control.controlId ?? ''
    const frameworkSlug = controlRow.framework.slug ?? undefined

    // Resolve canonical NIST family
    const canonical = await this.resolveCanonical(frameworkSlug ?? '', rawId)
    if (!canonical.family) return []

    // Look up SCF entries for this NIST family
    const scfEntries = lookupByNistFamily(canonical.family)
    if (scfEntries.length === 0) return []

    // Find controls in other frameworks that match via SCF crosswalk
    // This is a simplified suggestion: find controls whose controlId
    // matches SCF nistId patterns for the same family

    // Get existing pending suggestions to avoid duplicates
    const existing = await db
      .select()
      .from(mappingSuggestions)
      .where(
        and(
          eq(mappingSuggestions.sourceControlId, controlId),
          eq(mappingSuggestions.status, 'pending')
        )
      )

    const existingTargetIds = new Set(existing.map((s) => s.targetControlId))

    // AI placeholder hook — returns empty in Phase 1
    const aiSuggestions = await this._aiSuggestMappings(controlId, canonical)

    // SCF-based suggestions
    const scfSuggestions: MappingSuggestionResult[] = scfEntries
      .slice(0, 5)
      .map((entry) => ({
        targetControlId: '', // resolved by caller
        targetFramework: 'NIST 800-53 Rev 5',
        targetControlRef: entry.nistId,
        targetTitle: entry.scfTitle,
        confidence: entry.confidence,
        rationale: entry.notes ?? `SCF ${entry.scfId} → NIST ${entry.nistId}`,
        suggestedBy: 'scf' as const,
      }))
      .filter((s) => !existingTargetIds.has(s.targetControlId))

    return [...aiSuggestions, ...scfSuggestions].sort(
      (a, b) => b.confidence - a.confidence
    )
  }

  /**
   * Decode a HITRUST ID into its components.
   * Thin wrapper around hitrust-decoder.
   */
  decodeHitrustId(hitrustId: string) {
    return decodeHitrustId(hitrustId)
  }

  /**
   * Normalize a control ID for a given framework.
   * Handles HITRUST and ARC-AMPE quirks.
   *
   * CRITICAL: ARC-AMPE and HITRUST both reference NIST 800-53 but use DIFFERENT
   * control ID naming. Matching is done via canonical NIST ID, NOT string comparison.
   */
  normalizeControlId(frameworkSlug: string, rawId: string): string {
    if (!rawId) return ''

    const slug = frameworkSlug.toLowerCase()

    if (slug === 'hitrust' || isHitrustId(rawId)) {
      // HITRUST: normalize to 'DD.xx.NN' form
      const decoded = decodeHitrustId(rawId)
      if (decoded) {
        return `${decoded.domain}.${decoded.section}.${decoded.requirement}`
      }
    }

    if (slug === 'arc_ampe' || slug === 'arc-ampe') {
      // ARC-AMPE: may use different ID format from HITRUST
      // Normalize by uppercasing and collapsing whitespace
      return rawId.trim().toUpperCase().replace(/\s+/g, '-')
    }

    if (slug === 'nist_800_53' || slug === 'nist800-53') {
      // Normalize NIST IDs: AC-1, AC-1(1) etc.
      return rawId.trim().toUpperCase().replace(/\s+/g, '')
    }

    if (slug === 'iso27001') {
      // Normalize ISO IDs: A.5.1.1 → A.5.1.1 (consistent dot notation)
      return rawId.trim().toUpperCase().replace(/\s+/g, '').replace(/^A\.?/, 'A.')
    }

    // Default: trim and standardize
    return rawId.trim().replace(/\s+/g, '-')
  }

  /**
   * Normalize a full framework upload.
   * Thin wrapper around framework-normalizer.
   */
  normalizeUpload(
    content: string,
    format: 'csv' | 'json' | 'xlsx',
    frameworkSlug?: string
  ): NormalizedControl[] {
    return normalizeFrameworkUpload(content, format, frameworkSlug)
  }

  /**
   * Detect the framework from a set of normalized controls.
   */
  detectFramework(controls: NormalizedControl[]): string | null {
    return detectFramework(controls)
  }

  /**
   * Get a canonical control record by NIST ID.
   */
  async getCanonicalControl(nistId: string): Promise<CanonicalControl | null> {
    const results = await db
      .select()
      .from(canonicalControls)
      .where(eq(canonicalControls.nistId, nistId.toUpperCase()))
      .limit(1)

    return results[0] ?? null
  }

  /**
   * Get all mapping rules for a NIST ID.
   */
  async getMappingRules(nistId: string): Promise<MappingRule[]> {
    return db
      .select()
      .from(mappingRules)
      .where(eq(mappingRules.nistId, nistId.toUpperCase()))
  }

  // ── Private: AI engine ───────────────────────────────────────────────────

  /**
   * Read AI provider configuration from system_settings.
   * Returns null if no provider is configured, along with a configRequired flag.
   */
  private async _getAiConfig(): Promise<{
    provider: 'openai' | 'gemini' | null
    apiKey: string | null
    model: string | null
    configRequired: boolean
  }> {
    const rows = await db.select().from(systemSettings).limit(1)
    const settings = rows[0]

    if (!settings) {
      return { provider: null, apiKey: null, model: null, configRequired: true }
    }

    const provider = settings.aiProvider as 'openai' | 'gemini' | null
    // API key is stored in extraConfig to avoid a dedicated column
    const extraConfig = settings.extraConfig as Record<string, string> | null
    const apiKey = extraConfig?.aiApiKey ?? null
    const model = settings.aiModel ?? null

    if (!provider || !apiKey) {
      return { provider, apiKey, model, configRequired: true }
    }

    return { provider, apiKey, model, configRequired: false }
  }

  /**
   * AI-suggested mappings.
   * Calls the configured AI provider (OpenAI or Gemini) to suggest mappings
   * for the given control. Falls back to an empty array if AI is not configured.
   *
   * Returns suggestions tagged with { configRequired: true } via the engine when
   * no provider is set up — callers should surface this to the user.
   */
  private async _aiSuggestMappings(
    controlId: string,
    canonical: ResolvedCanonical
  ): Promise<MappingSuggestionResult[]> {
    const aiConfig = await this._getAiConfig()

    // Expose configRequired flag through a module-level var so callers can check
    this._lastAiConfigRequired = aiConfig.configRequired

    if (aiConfig.configRequired) {
      return []
    }

    // Fetch the source control details
    const [controlRow] = await db
      .select({ control: controls, framework: frameworks })
      .from(controls)
      .innerJoin(frameworks, eq(controls.frameworkId, frameworks.id))
      .where(eq(controls.id, controlId))
      .limit(1)

    if (!controlRow) return []

    // Fetch candidate target controls (up to 40 controls from other frameworks)
    const targetControls = await db
      .select({ control: controls, framework: frameworks })
      .from(controls)
      .innerJoin(frameworks, eq(controls.frameworkId, frameworks.id))
      .where(
        and(
          // exclude the same framework
          eq(frameworks.isActive, true)
        )
      )
      .limit(40)

    // Filter out controls from the same framework
    const candidates = targetControls.filter(
      (r) => r.framework.id !== controlRow.framework.id
    )

    if (candidates.length === 0) return []

    const sourceControl = controlRow.control
    const candidateList = candidates
      .map((r) => `${r.control.controlId ?? r.control.id} — ${r.control.title} [${r.framework.shortName ?? r.framework.name}]`)
      .join('\n')

    const systemPrompt =
      'You are a compliance control mapping expert. Given a source control, identify the most relevant target framework controls. Return JSON only.'

    const userPrompt = `Source control:
ID: ${sourceControl.controlId ?? sourceControl.id}
Title: ${sourceControl.title}
Description: ${sourceControl.description ?? '(none)'}
Canonical NIST anchor: ${canonical.nistId ?? canonical.family ?? 'unknown'}

Target framework controls (ID — Title [Framework]):
${candidateList}

Return a JSON object in this exact format (no markdown, no extra text):
{
  "mappings": [
    {
      "targetRef": "<control ID from the list above>",
      "confidence": <integer 0-100>,
      "mappingType": "direct" | "partial" | "related",
      "rationale": "<one sentence explaining the relationship>"
    }
  ]
}

Return only the top 5 most relevant mappings. Omit controls with confidence below 40.`

    try {
      let rawJson: string | null = null

      if (aiConfig.provider === 'openai') {
        const model = aiConfig.model ?? 'gpt-4o-mini'
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${aiConfig.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: 1024,
            temperature: 0.1,
          }),
        })

        if (!res.ok) {
          console.error('[MappingEngine] OpenAI error:', res.status, await res.text())
          return []
        }

        const data = await res.json()
        rawJson = data.choices?.[0]?.message?.content ?? null

      } else if (aiConfig.provider === 'gemini') {
        const model = aiConfig.model ?? 'gemini-2.0-flash'
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${aiConfig.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemPrompt }] },
              contents: [{ parts: [{ text: userPrompt }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
            }),
          }
        )

        if (!res.ok) {
          console.error('[MappingEngine] Gemini error:', res.status, await res.text())
          return []
        }

        const data = await res.json()
        rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text ?? null
      }

      if (!rawJson) return []

      // Strip any markdown code fences the model may have added
      const cleaned = rawJson.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
      const parsed = JSON.parse(cleaned) as {
        mappings: Array<{
          targetRef: string
          confidence: number
          mappingType: 'direct' | 'partial' | 'related'
          rationale: string
        }>
      }

      if (!Array.isArray(parsed.mappings)) return []

      // Match targetRef back to actual DB control IDs
      const suggestions: MappingSuggestionResult[] = []

      for (const m of parsed.mappings) {
        // Find the candidate whose controlId or id matches the returned ref
        const match = candidates.find(
          (c) =>
            c.control.controlId === m.targetRef ||
            c.control.id === m.targetRef ||
            (c.control.controlId && m.targetRef.startsWith(c.control.controlId))
        )

        if (!match) continue

        suggestions.push({
          targetControlId: match.control.id,
          targetFramework: match.framework.name,
          targetControlRef: match.control.controlId,
          targetTitle: match.control.title,
          confidence: Math.min(100, Math.max(0, m.confidence)),
          rationale: m.rationale,
          suggestedBy: 'ai',
        })
      }

      // Persist suggestions to mapping_suggestions table
      if (suggestions.length > 0) {
        await db
          .insert(mappingSuggestions)
          .values(
            suggestions.map((s) => ({
              sourceControlId: controlId,
              targetControlId: s.targetControlId,
              confidence: s.confidence,
              rationale: s.rationale,
              suggestedBy: 'ai' as const,
              status: 'pending' as const,
            }))
          )
          .onConflictDoNothing()
      }

      return suggestions
    } catch (err) {
      console.error('[MappingEngine] AI suggest error:', err)
      return []
    }
  }

  // Tracks whether the last AI suggestion call required config (not configured)
  // Exposed so callers (API routes) can surface this to clients.
  _lastAiConfigRequired = false
}

// ── Singleton export ──────────────────────────────────────────────────────────
// In Next.js server components / API routes, instantiate per-request or use
// a module-level singleton (safe because MappingEngine has no mutable state).

export const mappingEngine = new MappingEngine()

// Re-export types from sub-modules for convenience
export type { NormalizedControl } from './framework-normalizer'
export type { DecodedHitrustId, HitrustCanonicalHint } from './hitrust-decoder'
export type { ScfEntry } from './scf-crosswalk'
