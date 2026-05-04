'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ModuleDetail {
  id: string
  title: string
  description: string | null
  content: string | null
  estimatedMinutes: number | null
  passingScore: number | null
  isRequired: boolean | null
  category: string
  difficulty: string
}

interface CompletionData {
  completedAt: string | null
  score: number | null
  passed: boolean | null
  certificateKey: string | null
  attemptCount: number | null
}

interface QuizQuestion {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

interface Props {
  module: ModuleDetail
  initialCompletion: CompletionData | null
  userName: string
}

// ── Quiz Bank (hardcoded per category) ────────────────────────────────────────

const QUIZ_BANK: Record<string, QuizQuestion[]> = {
  'Security Awareness': [
    {
      question: 'Which of the following is NOT a type of malware?',
      options: ['Ransomware', 'Spyware', 'Firewall', 'Trojan'],
      correctIndex: 2,
      explanation: 'A firewall is a security control, not a type of malware. Ransomware, spyware, and trojans are all forms of malicious software.',
    },
    {
      question: 'What should you do immediately if you suspect your device has been compromised?',
      options: [
        'Try to remove the malware yourself',
        'Continue working and monitor the situation',
        'Disconnect from the network and notify your security team',
        'Restart your computer to clear the threat',
      ],
      correctIndex: 2,
      explanation: 'Immediately disconnect from the network to prevent lateral movement and notify your security team. Do not attempt to investigate or resolve it yourself.',
    },
    {
      question: 'Which practice is most important for protecting your work accounts?',
      options: [
        'Using the same strong password across all accounts',
        'Enabling multi-factor authentication (MFA)',
        'Sharing your password only with trusted colleagues',
        'Changing your password once a year',
      ],
      correctIndex: 1,
      explanation: 'MFA adds a critical layer of protection. Even if a password is compromised, MFA prevents unauthorized access.',
    },
    {
      question: 'What is social engineering?',
      options: [
        'Using social media for professional networking',
        'Exploiting software vulnerabilities in social platforms',
        'Manipulating people psychologically to gain unauthorized access',
        'Engineering social networks for communication',
      ],
      correctIndex: 2,
      explanation: 'Social engineering exploits human psychology rather than technical vulnerabilities to trick people into divulging information or taking harmful actions.',
    },
    {
      question: 'What is the recommended action when connecting to an unsecured public Wi-Fi network for work?',
      options: [
        'Avoid using any internet-connected services',
        'Use a VPN to encrypt your connection',
        'Only visit HTTPS websites',
        'Disable file sharing on your device',
      ],
      correctIndex: 1,
      explanation: 'A VPN encrypts your entire internet connection, protecting your data from eavesdropping even on untrusted networks.',
    },
  ],

  'Privacy & Data Protection': [
    {
      question: 'What is the maximum fine under GDPR for the most serious violations?',
      options: [
        '€5 million or 1% of global turnover',
        '€10 million or 2% of global turnover',
        '€20 million or 4% of global turnover',
        '€50 million or 10% of global turnover',
      ],
      correctIndex: 2,
      explanation: 'GDPR allows fines up to €20 million or 4% of annual global turnover, whichever is higher, for the most serious violations.',
    },
    {
      question: 'What is the "Right to be Forgotten" under GDPR?',
      options: [
        'The right to opt out of targeted advertising',
        'The right to request deletion of personal data',
        'The right to remain anonymous online',
        'The right to correct inaccurate data',
      ],
      correctIndex: 1,
      explanation: 'Also called the Right to Erasure, this allows individuals to request that organizations delete their personal data under certain conditions.',
    },
    {
      question: 'Under GDPR, within how many hours must a supervisory authority be notified of a personal data breach?',
      options: ['24 hours', '48 hours', '72 hours', '7 days'],
      correctIndex: 2,
      explanation: 'GDPR requires notification to the relevant supervisory authority within 72 hours of becoming aware of a breach, where the breach poses a risk to individuals\' rights.',
    },
    {
      question: 'Which of the following is considered personal data under GDPR?',
      options: [
        'Anonymized statistical data',
        'Company financial reports',
        'An individual\'s IP address',
        'Product pricing information',
      ],
      correctIndex: 2,
      explanation: 'An IP address can identify a natural person and is therefore considered personal data under GDPR.',
    },
    {
      question: 'What does "lawful basis for processing" mean under GDPR?',
      options: [
        'Processing data only in EU countries',
        'Having a legal justification for processing personal data',
        'Using data only for law enforcement purposes',
        'Storing data in encrypted format',
      ],
      correctIndex: 1,
      explanation: 'GDPR requires that every processing activity has a lawful basis — such as consent, contract, legal obligation, or legitimate interests.',
    },
  ],

  'Compliance': [
    {
      question: 'Which Trust Service Criterion is REQUIRED for all SOC 2 audits?',
      options: ['Availability', 'Processing Integrity', 'Security', 'Privacy'],
      correctIndex: 2,
      explanation: 'Security (Common Criteria) is the only mandatory Trust Service Criterion in SOC 2. The other four are optional.',
    },
    {
      question: 'What is the recommended encryption standard for data at rest in a SOC 2 environment?',
      options: ['DES', 'MD5', 'AES-256', 'SHA-1'],
      correctIndex: 2,
      explanation: 'AES-256 is the industry standard for encrypting data at rest in SOC 2 compliant systems.',
    },
    {
      question: 'Why is code review considered a SOC 2 control?',
      options: [
        'It speeds up deployment pipelines',
        'It provides evidence of separation of duties in change management',
        'It is required by NIST guidelines',
        'It reduces the need for penetration testing',
      ],
      correctIndex: 1,
      explanation: 'Code review demonstrates that no single person has sole control over changes, satisfying separation of duties requirements in change management controls.',
    },
    {
      question: 'Which practice violates SOC 2 secrets management requirements?',
      options: [
        'Using AWS Secrets Manager for API keys',
        'Rotating credentials on a schedule',
        'Hardcoding database passwords in application source code',
        'Using environment variables for configuration',
      ],
      correctIndex: 2,
      explanation: 'Hardcoding credentials in source code is a critical violation. Credentials must be stored in dedicated secrets management systems.',
    },
    {
      question: 'What should audit logs include for SOC 2 compliance?',
      options: [
        'User passwords and authentication tokens',
        'User IDs, timestamps, and action types',
        'Only failed authentication attempts',
        'Database query execution plans',
      ],
      correctIndex: 1,
      explanation: 'Audit logs must include user IDs, timestamps, and action types. They must never include passwords, tokens, or sensitive PII.',
    },
  ],

  'Identity & Access': [
    {
      question: 'What does the Principle of Least Privilege mean?',
      options: [
        'Users should have the least number of accounts possible',
        'Users should only have access to resources required for their job',
        'Admin accounts should be used as little as possible',
        'Access should be granted to the smallest team possible',
      ],
      correctIndex: 1,
      explanation: 'The Principle of Least Privilege means granting each user, application, and system only the minimum access needed to perform their function.',
    },
    {
      question: 'What is "Just-In-Time (JIT) access" in the context of Privileged Access Management?',
      options: [
        'Granting access as soon as an employee is hired',
        'Providing elevated access only when needed and for a limited duration',
        'Automatically approving access requests within 24 hours',
        'Giving permanent admin access to avoid delays',
      ],
      correctIndex: 1,
      explanation: 'JIT access grants elevated privileges only when there is a business need and automatically revokes them after the task is complete, reducing the attack surface.',
    },
    {
      question: 'What is Separation of Duties?',
      options: [
        'Dividing the IT team into separate departments',
        'Ensuring no single person has sole control over a critical process',
        'Separating development and production environments',
        'Having different passwords for different systems',
      ],
      correctIndex: 1,
      explanation: 'Separation of Duties prevents fraud and error by requiring multiple individuals to complete sensitive transactions or critical processes.',
    },
    {
      question: 'When should access be reviewed for an employee?',
      options: [
        'Only when they are terminated',
        'Once every five years',
        'When they change roles, go on extended leave, or leave the organization',
        'Only when requested by the employee',
      ],
      correctIndex: 2,
      explanation: 'Access reviews should be triggered by lifecycle events such as role changes, extended leave, or termination, as well as on a regular schedule (quarterly for privileged access).',
    },
    {
      question: 'What is the core principle of Zero Trust architecture?',
      options: [
        'Trust users who are inside the corporate network',
        'Trust no user or device by default — always verify',
        'Remove all network perimeters',
        'Trust verified vendors but not employees',
      ],
      correctIndex: 1,
      explanation: 'Zero Trust assumes that neither users inside nor outside the network perimeter should be trusted by default. Every access request must be explicitly verified.',
    },
  ],

  'Incident Response': [
    {
      question: 'What is the FIRST thing you should do if you suspect an active security breach on your device?',
      options: [
        'Document the incident in detail before doing anything else',
        'Disconnect the device from the network',
        'Restart the device to clear malware',
        'Notify your manager via email from the affected device',
      ],
      correctIndex: 1,
      explanation: 'Immediately disconnecting from the network prevents the attacker from exfiltrating more data or moving laterally to other systems.',
    },
    {
      question: 'What are the four phases of the NIST incident response lifecycle?',
      options: [
        'Detect, Respond, Recover, Report',
        'Identify, Contain, Eradicate, Close',
        'Preparation, Detection & Analysis, Containment/Eradication/Recovery, Post-Incident Activity',
        'Plan, Act, Check, Improve',
      ],
      correctIndex: 2,
      explanation: 'The NIST incident response lifecycle consists of: Preparation, Detection & Analysis, Containment/Eradication/Recovery, and Post-Incident Activity.',
    },
    {
      question: 'What is the purpose of a Post-Incident Review (PIR)?',
      options: [
        'To identify and punish those responsible for the breach',
        'To learn lessons and improve security controls and processes',
        'To document the incident for insurance claims',
        'To notify regulatory authorities about the breach',
      ],
      correctIndex: 1,
      explanation: 'A PIR focuses on learning — understanding what happened, why, how it was handled, what worked, and what should be improved to prevent recurrence.',
    },
    {
      question: 'Which is an example of a common Indicator of Compromise (IoC)?',
      options: [
        'A user logging in during business hours',
        'A scheduled system backup completing successfully',
        'Multiple failed logins followed by a successful login from an unusual location',
        'A software update completing automatically',
      ],
      correctIndex: 2,
      explanation: 'Multiple failed logins followed by success, especially from unusual locations, is a classic IoC suggesting credential stuffing or brute force attacks.',
    },
    {
      question: 'Under GDPR, within what timeframe must affected individuals be notified in a high-risk personal data breach?',
      options: [
        '24 hours',
        'Without undue delay (as soon as practicable)',
        '60 days',
        '30 business days',
      ],
      correctIndex: 1,
      explanation: 'GDPR requires notifying affected individuals "without undue delay" when a breach is likely to result in a high risk to their rights and freedoms.',
    },
  ],
}

const DEFAULT_QUESTIONS: QuizQuestion[] = [
  {
    question: 'What is the primary goal of information security?',
    options: [
      'To prevent all cyberattacks',
      'To protect the confidentiality, integrity, and availability of information',
      'To monitor employee activity',
      'To comply with regulations',
    ],
    correctIndex: 1,
    explanation: 'The CIA triad — Confidentiality, Integrity, Availability — is the foundational model of information security.',
  },
  {
    question: 'What is a security policy?',
    options: [
      'A technical control that prevents unauthorized access',
      'A set of documented rules governing security practices',
      'A type of security insurance',
      'A government regulation',
    ],
    correctIndex: 1,
    explanation: 'A security policy is a formal document that outlines an organization\'s approach to managing information security.',
  },
  {
    question: 'What does "defense in depth" mean?',
    options: [
      'Using a very strong firewall',
      'Having multiple layers of security controls',
      'Training employees on security',
      'Hiring a dedicated security team',
    ],
    correctIndex: 1,
    explanation: 'Defense in depth applies multiple layers of security controls so that if one fails, others still protect the organization.',
  },
  {
    question: 'What is the best way to verify a suspicious request from a colleague?',
    options: [
      'Reply to their email to confirm',
      'Check their LinkedIn profile',
      'Contact them through a separate, known communication channel',
      'Assume it is legitimate if it looks official',
    ],
    correctIndex: 2,
    explanation: 'Verify through a separate trusted channel (phone call, in-person) using a known contact method, not by replying to the suspicious message.',
  },
  {
    question: 'What is a data breach?',
    options: [
      'Any unauthorized copying of data, regardless of intent',
      'A security incident where unauthorized parties access protected data',
      'Losing a USB drive with personal files',
      'Accidentally emailing the wrong person',
    ],
    correctIndex: 1,
    explanation: 'A data breach is a security incident resulting in unauthorized access to, disclosure of, or loss of protected information.',
  },
]

// ── Markdown renderer ─────────────────────────────────────────────────────────

function parseMarkdownSections(content: string): { heading: string; body: string }[] {
  const sections: { heading: string; body: string }[] = []
  const parts = content.split(/^## /m)

  for (const part of parts) {
    if (!part.trim()) continue
    const lines = part.split('\n')
    const heading = lines[0].trim()
    const body = lines.slice(1).join('\n').trim()
    if (heading) sections.push({ heading, body })
  }

  return sections
}

function renderBody(body: string): React.ReactNode {
  const lines = body.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []
  let inCodeBlock = false
  let codeLines: string[] = []

  const flushList = (key: string) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key} style={{ margin: '10px 0', paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.75 }}>
          {listItems.map((item, i) => (
            <li key={i} style={{ marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
          ))}
        </ul>
      )
      listItems = []
    }
  }

  lines.forEach((line, i) => {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={i} style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: 12.5,
            color: '#a5f3fc',
            overflowX: 'auto',
            margin: '12px 0',
            fontFamily: 'monospace',
          }}>
            {codeLines.join('\n')}
          </pre>
        )
        codeLines = []
        inCodeBlock = false
      } else {
        flushList(`fl-${i}`)
        inCodeBlock = true
      }
      return
    }

    if (inCodeBlock) {
      codeLines.push(line)
      return
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(line.slice(2))
      return
    }

    if (/^\d+\. /.test(line)) {
      flushList(`fl-${i}`)
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 10, margin: '6px 0', color: 'var(--text-secondary)', fontSize: 14 }}>
          <span style={{ color: 'var(--violet)', fontWeight: 700, flexShrink: 0 }}>{line.match(/^\d+/)?.[0]}.</span>
          <span dangerouslySetInnerHTML={{ __html: formatInline(line.replace(/^\d+\. /, '')) }} />
        </div>
      )
      return
    }

    flushList(`fl-${i}`)

    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={i} style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '18px 0 6px', letterSpacing: '-0.01em' }}>
          {line.slice(4)}
        </h4>
      )
      return
    }

    if (line.startsWith('| ')) {
      // Simple table row
      const cells = line.split('|').filter(Boolean).map(c => c.trim())
      if (cells.every(c => /^[-\s]+$/.test(c))) return // separator row
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {cells.map((cell, ci) => (
            <div key={ci} style={{ flex: 1, padding: '6px 10px', fontSize: 13, color: 'var(--text-secondary)' }}>
              {cell}
            </div>
          ))}
        </div>
      )
      return
    }

    if (line.trim()) {
      elements.push(
        <p key={i} style={{ margin: '8px 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}
          dangerouslySetInnerHTML={{ __html: formatInline(line) }}
        />
      )
    }
  })

  flushList('final')
  return <>{elements}</>
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary);font-weight:600">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(139,92,246,0.15);color:#a78bfa;padding:1px 5px;border-radius:3px;font-size:0.9em">$1</code>')
}

// ── Difficulty / Category colors ───────────────────────────────────────────────

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: '#22C55E',
  intermediate: '#F59E0B',
  advanced: '#EF4444',
}

const CATEGORY_COLORS: Record<string, string> = {
  'Security Awareness': '#8B5CF6',
  'Privacy & Data Protection': '#06B6D4',
  'Compliance': '#10B981',
  'Identity & Access': '#F59E0B',
  'Incident Response': '#EF4444',
  'General': '#6B7280',
}

// ── Main Client Component ─────────────────────────────────────────────────────

export function TrainingModuleClient({ module, initialCompletion, userName }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'learn' | 'assessment' | 'certificate'>('learn')
  const [readSections, setReadSections] = useState<Set<number>>(new Set())
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [quizResult, setQuizResult] = useState<{ passed: boolean; score: number; passingScore: number; certificateId?: string } | null>(null)
  const [completion, setCompletion] = useState<CompletionData | null>(initialCompletion)
  const [submitting, setSubmitting] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const sections = parseMarkdownSections(module.content ?? '')
  const questions = QUIZ_BANK[module.category] ?? DEFAULT_QUESTIONS
  const catColor = CATEGORY_COLORS[module.category] ?? '#6B7280'
  const diffColor = DIFFICULTY_COLORS[module.difficulty] ?? '#6B7280'

  const readProgress = sections.length > 0 ? (readSections.size / sections.length) * 100 : 0

  const toggleSection = useCallback((idx: number) => {
    setReadSections((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }, [])

  const handleAnswerSelect = (qIdx: number, aIdx: number) => {
    if (quizSubmitted) return
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: aIdx }))
  }

  const handleSubmitQuiz = async () => {
    if (Object.keys(selectedAnswers).length < questions.length) {
      alert('Please answer all questions before submitting.')
      return
    }

    const correctCount = questions.reduce((count, q, idx) => {
      return count + (selectedAnswers[idx] === q.correctIndex ? 1 : 0)
    }, 0)

    const score = Math.round((correctCount / questions.length) * 100)

    setSubmitting(true)
    try {
      const res = await fetch(`/api/training/modules/${module.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, timeSpent: 0 }),
      })
      const data = await res.json()

      setQuizResult({
        passed: data.passed,
        score,
        passingScore: data.passingScore,
        certificateId: data.certificateId,
      })
      setQuizSubmitted(true)
      setShowModal(true)

      if (data.passed) {
        setCompletion({
          completedAt: new Date().toISOString(),
          score,
          passed: true,
          certificateKey: data.certificateId,
          attemptCount: (completion?.attemptCount ?? 0) + 1,
        })
      }
    } catch {
      alert('Failed to submit quiz. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const resetQuiz = () => {
    setSelectedAnswers({})
    setQuizSubmitted(false)
    setQuizResult(null)
    setShowModal(false)
  }

  const isPassed = completion?.passed === true

  const tabs: { id: 'learn' | 'assessment' | 'certificate'; label: string }[] = [
    { id: 'learn', label: 'Learn' },
    { id: 'assessment', label: 'Assessment' },
    ...(isPassed ? [{ id: 'certificate' as const, label: 'Certificate' }] : []),
  ]

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Back link */}
      <Link
        href="/training"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 20 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back to Training
      </Link>

      {/* Module header */}
      <div className="glass-card" style={{ borderRadius: 'var(--radius-lg)', padding: '24px 28px', marginBottom: 24, border: isPassed ? '1px solid rgba(34,197,94,0.2)' : undefined }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: catColor,
            background: `${catColor}18`, border: `1px solid ${catColor}30`,
            borderRadius: 4, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {module.category}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, color: diffColor,
            background: `${diffColor}18`, border: `1px solid ${diffColor}30`,
            borderRadius: 4, padding: '2px 8px', textTransform: 'capitalize',
          }}>
            {module.difficulty}
          </span>
          {isPassed && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: '#22C55E',
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 4, padding: '2px 8px',
            }}>
              ✓ Completed
            </span>
          )}
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          {module.title}
        </h1>
        {module.description && (
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.6 }}>
            {module.description}
          </p>
        )}

        <div style={{ display: 'flex', gap: 20 }}>
          {module.estimatedMinutes && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {module.estimatedMinutes} min
            </span>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Pass score: {module.passingScore ?? 80}%
          </span>
          {completion && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Attempts: {completion.attemptCount ?? 1}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 0 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #8B5CF6' : '2px solid transparent',
              color: activeTab === tab.id ? '#8B5CF6' : 'var(--text-muted)',
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              marginBottom: -1,
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Learn ── */}
      {activeTab === 'learn' && (
        <div>
          {/* Progress bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reading progress</span>
              <span style={{ fontSize: 12, color: '#8B5CF6', fontWeight: 600 }}>{Math.round(readProgress)}%</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${readProgress}%`, background: 'linear-gradient(90deg, #7C3AED, #06B6D4)', borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
          </div>

          {sections.length === 0 ? (
            <div className="glass-card" style={{ padding: 32, borderRadius: 12, textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No content available for this module.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {sections.map((section, idx) => (
                <div
                  key={idx}
                  className="glass-card"
                  style={{
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: readSections.has(idx) ? '1px solid rgba(34,197,94,0.2)' : undefined,
                  }}
                >
                  {/* Section header */}
                  <div style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                      {section.heading}
                    </h2>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                      <span style={{ fontSize: 12, color: readSections.has(idx) ? '#22C55E' : 'var(--text-muted)' }}>
                        {readSections.has(idx) ? 'Read ✓' : 'Mark as read'}
                      </span>
                      <input
                        type="checkbox"
                        checked={readSections.has(idx)}
                        onChange={() => toggleSection(idx)}
                        style={{ accentColor: '#22C55E', width: 16, height: 16, cursor: 'pointer' }}
                      />
                    </label>
                  </div>
                  {/* Section body */}
                  <div style={{ padding: '16px 20px' }}>
                    {renderBody(section.body)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CTA to assessment */}
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <button
              onClick={() => setActiveTab('assessment')}
              style={{
                padding: '12px 28px',
                background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Proceed to Assessment →
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: Assessment ── */}
      {activeTab === 'assessment' && (
        <div>
          {!quizSubmitted ? (
            <div>
              <div className="glass-card" style={{ padding: '16px 20px', borderRadius: 12, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Answer all {questions.length} questions to complete the assessment.
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#8B5CF6' }}>
                  {Object.keys(selectedAnswers).length} / {questions.length} answered
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {questions.map((q, qIdx) => (
                  <div key={qIdx} className="glass-card" style={{ padding: '20px', borderRadius: 12 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px', lineHeight: 1.5 }}>
                      <span style={{ color: '#8B5CF6', marginRight: 8 }}>Q{qIdx + 1}.</span>
                      {q.question}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {q.options.map((option, aIdx) => {
                        const isSelected = selectedAnswers[qIdx] === aIdx
                        return (
                          <button
                            key={aIdx}
                            onClick={() => handleAnswerSelect(qIdx, aIdx)}
                            style={{
                              padding: '11px 16px',
                              textAlign: 'left',
                              background: isSelected ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.02)',
                              border: isSelected ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.06)',
                              borderRadius: 8,
                              color: isSelected ? '#c4b5fd' : 'var(--text-secondary)',
                              fontSize: 14,
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                            }}
                          >
                            <span style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              border: isSelected ? '2px solid #8B5CF6' : '2px solid rgba(255,255,255,0.15)',
                              background: isSelected ? 'rgba(139,92,246,0.2)' : 'transparent',
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 10,
                              fontWeight: 700,
                              color: isSelected ? '#8B5CF6' : 'var(--text-muted)',
                            }}>
                              {String.fromCharCode(65 + aIdx)}
                            </span>
                            {option}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <button
                  onClick={handleSubmitQuiz}
                  disabled={submitting || Object.keys(selectedAnswers).length < questions.length}
                  style={{
                    padding: '12px 32px',
                    background: Object.keys(selectedAnswers).length < questions.length
                      ? 'rgba(255,255,255,0.05)'
                      : 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                    color: Object.keys(selectedAnswers).length < questions.length ? 'var(--text-muted)' : '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: Object.keys(selectedAnswers).length < questions.length ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? 'Submitting...' : 'Submit Assessment'}
                </button>
              </div>
            </div>
          ) : (
            // Results view
            <div>
              <div className="glass-card" style={{
                padding: '28px',
                borderRadius: 12,
                marginBottom: 20,
                border: quizResult?.passed ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(239,68,68,0.3)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>
                  {quizResult?.passed ? '🎉' : '📚'}
                </div>
                <h2 style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: quizResult?.passed ? '#22C55E' : '#EF4444',
                  margin: '0 0 8px',
                }}>
                  {quizResult?.passed ? 'Congratulations! You passed!' : 'Not quite — keep studying!'}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 16px' }}>
                  Your score: <strong style={{ color: 'var(--text-primary)', fontSize: 20 }}>{quizResult?.score}%</strong>
                  {' '}(passing: {quizResult?.passingScore}%)
                </p>
                {quizResult?.passed && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
                    Your certificate has been issued. View it in the Certificate tab.
                  </p>
                )}
              </div>

              {/* Answer review */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {questions.map((q, qIdx) => {
                  const selected = selectedAnswers[qIdx]
                  const isCorrect = selected === q.correctIndex
                  return (
                    <div key={qIdx} className="glass-card" style={{
                      padding: '20px',
                      borderRadius: 12,
                      border: isCorrect ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(239,68,68,0.2)',
                    }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px' }}>
                        <span style={{ color: isCorrect ? '#22C55E' : '#EF4444', marginRight: 8 }}>
                          {isCorrect ? '✓' : '✗'}
                        </span>
                        Q{qIdx + 1}. {q.question}
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 8px' }}>
                        Your answer: <span style={{ color: isCorrect ? '#22C55E' : '#EF4444', fontWeight: 600 }}>
                          {q.options[selected] ?? 'Not answered'}
                        </span>
                      </p>
                      {!isCorrect && (
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 8px' }}>
                          Correct answer: <span style={{ color: '#22C55E', fontWeight: 600 }}>{q.options[q.correctIndex]}</span>
                        </p>
                      )}
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, lineHeight: 1.6 }}>
                        {q.explanation}
                      </p>
                    </div>
                  )
                })}
              </div>

              <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
                {!quizResult?.passed && (
                  <button
                    onClick={resetQuiz}
                    style={{
                      padding: '11px 24px',
                      background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Try Again
                  </button>
                )}
                {quizResult?.passed && (
                  <button
                    onClick={() => setActiveTab('certificate')}
                    style={{
                      padding: '11px 24px',
                      background: 'linear-gradient(135deg, #059669, #047857)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    View Certificate
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('learn')}
                  style={{
                    padding: '11px 24px',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-secondary)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Review Content
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Certificate ── */}
      {activeTab === 'certificate' && isPassed && completion && (
        <div>
          {/* Certificate card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(109,40,217,0.15) 0%, rgba(6,182,212,0.08) 100%)',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 16,
            padding: '40px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Decorative corners */}
            <div style={{
              position: 'absolute', top: 12, left: 12,
              width: 40, height: 40,
              border: '2px solid rgba(139,92,246,0.3)',
              borderRight: 'none', borderBottom: 'none',
              borderRadius: '4px 0 0 0',
            }} />
            <div style={{
              position: 'absolute', top: 12, right: 12,
              width: 40, height: 40,
              border: '2px solid rgba(139,92,246,0.3)',
              borderLeft: 'none', borderBottom: 'none',
              borderRadius: '0 4px 0 0',
            }} />
            <div style={{
              position: 'absolute', bottom: 12, left: 12,
              width: 40, height: 40,
              border: '2px solid rgba(139,92,246,0.3)',
              borderRight: 'none', borderTop: 'none',
              borderRadius: '0 0 0 4px',
            }} />
            <div style={{
              position: 'absolute', bottom: 12, right: 12,
              width: 40, height: 40,
              border: '2px solid rgba(139,92,246,0.3)',
              borderLeft: 'none', borderTop: 'none',
              borderRadius: '0 0 4px 0',
            }} />

            <div style={{ marginBottom: 8 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 0 12px rgba(139,92,246,0.5))' }}>
                <path d="M12 2L4 6V12C4 16.4 7.4 20.5 12 22C16.6 20.5 20 16.4 20 12V6L12 2Z" fill="#8B5CF6" opacity="0.8"/>
                <polyline points="9 12 11 14 15 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: '#8B5CF6', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
              Certificate of Completion
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>This certifies that</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
              {userName}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>has successfully completed</div>

            <div style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#a78bfa',
              margin: '0 0 20px',
              padding: '12px 24px',
              background: 'rgba(139,92,246,0.1)',
              borderRadius: 8,
              display: 'inline-block',
            }}>
              {module.title}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Score</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#22C55E' }}>{completion.score}%</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Completed</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {completion.completedAt
                    ? new Date(completion.completedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                    : '—'}
                </div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Category</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: catColor }}>{module.category}</div>
              </div>
            </div>

            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em', fontFamily: 'monospace' }}>
              Certificate ID: {completion.certificateKey}
            </div>

            <div style={{ marginTop: 24 }}>
              <button
                onClick={() => alert('PDF download coming soon!')}
                style={{
                  padding: '10px 24px',
                  background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pass/Fail Modal ── */}
      {showModal && quizResult && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0F1221',
              border: `1px solid ${quizResult.passed ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              borderRadius: 16,
              padding: 40,
              maxWidth: 420,
              width: '90%',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 56, marginBottom: 16 }}>
              {quizResult.passed ? '🎉' : '📚'}
            </div>
            <h2 style={{
              fontSize: 22,
              fontWeight: 700,
              color: quizResult.passed ? '#22C55E' : '#EF4444',
              margin: '0 0 8px',
            }}>
              {quizResult.passed ? 'You Passed!' : 'Keep Studying'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 20px', lineHeight: 1.6 }}>
              {quizResult.passed
                ? `Score: ${quizResult.score}% — You've earned your certificate for ${module.title}.`
                : `Score: ${quizResult.score}% — You need ${quizResult.passingScore}% to pass. Review the material and try again.`}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {quizResult.passed ? (
                <button
                  onClick={() => { setShowModal(false); setActiveTab('certificate') }}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #059669, #047857)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  View Certificate
                </button>
              ) : (
                <button
                  onClick={() => { setShowModal(false); resetQuiz() }}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Try Again
                </button>
              )}
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '10px 20px',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-secondary)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
