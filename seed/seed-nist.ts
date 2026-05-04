/**
 * CompliGuard v2 — NIST 800-53 Rev 5 Canonical Controls Seed
 * Seeds all 20 control families with representative controls.
 * These serve as the universal anchor for cross-framework mapping.
 *
 * Usage: DATABASE_URL=... npx tsx seed/seed-nist.ts
 */

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { canonicalControls } from '../lib/db/schema/mapping_engine'
import { sql } from 'drizzle-orm'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required')
  process.exit(1)
}

const client = postgres(DATABASE_URL, { max: 1 })
const db = drizzle(client)

// ── NIST 800-53 Rev 5 — All 20 Families ──────────────────────────────────────

const NIST_CONTROLS = [
  // ── AC: Access Control ────────────────────────────────────────────────────
  { nistId: 'AC-1',  family: 'AC', familyName: 'Access Control', priority: 'P1', baselineImpact: 'LOW',      title: 'Access Control Policy and Procedures',    description: 'Develop, document, and disseminate to [Assignment: organization-defined personnel or roles] an access control policy that addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance; and procedures to facilitate the implementation of the access control policy and the associated access controls.' },
  { nistId: 'AC-2',  family: 'AC', familyName: 'Access Control', priority: 'P1', baselineImpact: 'LOW',      title: 'Account Management',                      description: 'Manage system accounts, including establishing, activating, modifying, reviewing, disabling, and removing accounts.' },
  { nistId: 'AC-3',  family: 'AC', familyName: 'Access Control', priority: 'P1', baselineImpact: 'LOW',      title: 'Access Enforcement',                      description: 'Enforce approved authorizations for logical access to information and system resources in accordance with applicable access control policies.' },
  { nistId: 'AC-4',  family: 'AC', familyName: 'Access Control', priority: 'P1', baselineImpact: 'MODERATE', title: 'Information Flow Enforcement',             description: 'Enforce approved authorizations for controlling the flow of information within the system and between connected systems.' },
  { nistId: 'AC-5',  family: 'AC', familyName: 'Access Control', priority: 'P1', baselineImpact: 'MODERATE', title: 'Separation of Duties',                     description: 'Separate duties of individuals as necessary to prevent malicious activity without collusion.' },
  { nistId: 'AC-6',  family: 'AC', familyName: 'Access Control', priority: 'P1', baselineImpact: 'LOW',      title: 'Least Privilege',                         description: 'Employ the principle of least privilege, allowing only authorized accesses for users (or processes acting on behalf of users) that are necessary to accomplish assigned organizational tasks.' },
  { nistId: 'AC-7',  family: 'AC', familyName: 'Access Control', priority: 'P2', baselineImpact: 'LOW',      title: 'Unsuccessful Logon Attempts',             description: 'Enforce a limit of consecutive invalid logon attempts by a user during a time period.' },
  { nistId: 'AC-8',  family: 'AC', familyName: 'Access Control', priority: 'P2', baselineImpact: 'LOW',      title: 'System Use Notification',                 description: 'Display an approved system use notification message or banner before granting access to the system.' },
  { nistId: 'AC-11', family: 'AC', familyName: 'Access Control', priority: 'P3', baselineImpact: 'MODERATE', title: 'Device Lock',                             description: 'Prevent further access to the system by initiating a device lock after a period of inactivity.' },
  { nistId: 'AC-12', family: 'AC', familyName: 'Access Control', priority: 'P2', baselineImpact: 'MODERATE', title: 'Session Termination',                     description: 'Automatically terminate a user session after a defined condition.' },
  { nistId: 'AC-14', family: 'AC', familyName: 'Access Control', priority: 'P3', baselineImpact: 'LOW',      title: 'Permitted Actions Without Identification or Authentication', description: 'Identify and document user actions that can be performed without identification or authentication.' },
  { nistId: 'AC-17', family: 'AC', familyName: 'Access Control', priority: 'P2', baselineImpact: 'LOW',      title: 'Remote Access',                           description: 'Establish and document usage restrictions, configuration/connection requirements, and implementation guidance for remote access.' },
  { nistId: 'AC-18', family: 'AC', familyName: 'Access Control', priority: 'P1', baselineImpact: 'LOW',      title: 'Wireless Access',                         description: 'Establish configuration requirements, connection requirements, and implementation guidance for wireless access.' },
  { nistId: 'AC-19', family: 'AC', familyName: 'Access Control', priority: 'P1', baselineImpact: 'LOW',      title: 'Access Control for Mobile Devices',       description: 'Establish configuration requirements, connection requirements, and implementation guidance for organization-controlled mobile devices.' },
  { nistId: 'AC-20', family: 'AC', familyName: 'Access Control', priority: 'P1', baselineImpact: 'LOW',      title: 'Use of External Systems',                 description: 'Supplement access controls with external system connection policies.' },
  { nistId: 'AC-21', family: 'AC', familyName: 'Access Control', priority: 'P2', baselineImpact: 'MODERATE', title: 'Information Sharing',                     description: 'Enable authorized users to determine whether access authorizations assigned to a sharing partner match the access restrictions on the information.' },
  { nistId: 'AC-22', family: 'AC', familyName: 'Access Control', priority: 'P3', baselineImpact: 'LOW',      title: 'Publicly Accessible Content',             description: 'Designate individuals authorized to post information onto a publicly accessible system.' },

  // ── AT: Awareness and Training ─────────────────────────────────────────────
  { nistId: 'AT-1',  family: 'AT', familyName: 'Awareness and Training', priority: 'P1', baselineImpact: 'LOW',      title: 'Awareness and Training Policy and Procedures', description: 'Develop, document, and disseminate an awareness and training policy and procedures.' },
  { nistId: 'AT-2',  family: 'AT', familyName: 'Awareness and Training', priority: 'P1', baselineImpact: 'LOW',      title: 'Literacy Training and Awareness',              description: 'Provide basic cybersecurity awareness training to all users (including managers, senior executives, and contractors).' },
  { nistId: 'AT-3',  family: 'AT', familyName: 'Awareness and Training', priority: 'P1', baselineImpact: 'LOW',      title: 'Role-Based Training',                          description: 'Provide role-based security and privacy training to personnel with assigned security roles and responsibilities.' },
  { nistId: 'AT-4',  family: 'AT', familyName: 'Awareness and Training', priority: 'P3', baselineImpact: 'LOW',      title: 'Training Records',                             description: 'Document and monitor information security and privacy training activities.' },

  // ── AU: Audit and Accountability ───────────────────────────────────────────
  { nistId: 'AU-1',  family: 'AU', familyName: 'Audit and Accountability', priority: 'P1', baselineImpact: 'LOW',      title: 'Audit and Accountability Policy and Procedures', description: 'Develop and disseminate audit and accountability policy and procedures.' },
  { nistId: 'AU-2',  family: 'AU', familyName: 'Audit and Accountability', priority: 'P1', baselineImpact: 'LOW',      title: 'Event Logging',                                  description: 'Identify the types of events that the system is capable of logging in support of the audit function.' },
  { nistId: 'AU-3',  family: 'AU', familyName: 'Audit and Accountability', priority: 'P1', baselineImpact: 'LOW',      title: 'Content of Audit Records',                       description: 'Ensure that audit records contain sufficient information to establish what events occurred, the sources of the events, and the outcomes of the events.' },
  { nistId: 'AU-4',  family: 'AU', familyName: 'Audit and Accountability', priority: 'P1', baselineImpact: 'LOW',      title: 'Audit Log Storage Capacity',                     description: 'Allocate audit log storage capacity to accommodate retention requirements.' },
  { nistId: 'AU-5',  family: 'AU', familyName: 'Audit and Accountability', priority: 'P1', baselineImpact: 'LOW',      title: 'Response to Audit Logging Process Failures',     description: 'Alert the organization when audit log processes fail and take appropriate actions.' },
  { nistId: 'AU-6',  family: 'AU', familyName: 'Audit and Accountability', priority: 'P1', baselineImpact: 'LOW',      title: 'Audit Record Review, Analysis, and Reporting',   description: 'Review and analyze system audit records for indications of inappropriate or unusual activity.' },
  { nistId: 'AU-7',  family: 'AU', familyName: 'Audit and Accountability', priority: 'P2', baselineImpact: 'LOW',      title: 'Audit Record Reduction and Report Generation',   description: 'Provide an audit record reduction and report generation capability.' },
  { nistId: 'AU-8',  family: 'AU', familyName: 'Audit and Accountability', priority: 'P1', baselineImpact: 'LOW',      title: 'Time Stamps',                                    description: 'Use internal system clocks to generate time stamps for audit records.' },
  { nistId: 'AU-9',  family: 'AU', familyName: 'Audit and Accountability', priority: 'P1', baselineImpact: 'LOW',      title: 'Protection of Audit Information',                description: 'Protect audit information and audit tools from unauthorized access, modification, and deletion.' },
  { nistId: 'AU-10', family: 'AU', familyName: 'Audit and Accountability', priority: 'P2', baselineImpact: 'HIGH',     title: 'Non-Repudiation',                                description: 'Provide irrefutable evidence that an individual (or process acting on behalf of an individual) took a specific action.' },
  { nistId: 'AU-11', family: 'AU', familyName: 'Audit and Accountability', priority: 'P3', baselineImpact: 'LOW',      title: 'Audit Record Retention',                         description: 'Retain audit records for a required time period to provide support for after-the-fact investigations.' },
  { nistId: 'AU-12', family: 'AU', familyName: 'Audit and Accountability', priority: 'P1', baselineImpact: 'LOW',      title: 'Audit Record Generation',                        description: 'Provide audit record generation capability for the event types defined in AU-2.' },

  // ── CA: Assessment, Authorization, and Monitoring ─────────────────────────
  { nistId: 'CA-1',  family: 'CA', familyName: 'Assessment, Authorization, and Monitoring', priority: 'P1', baselineImpact: 'LOW',      title: 'Assessment, Authorization, and Monitoring Policy and Procedures', description: 'Develop and disseminate policies and procedures for security assessments, authorization, and continuous monitoring.' },
  { nistId: 'CA-2',  family: 'CA', familyName: 'Assessment, Authorization, and Monitoring', priority: 'P2', baselineImpact: 'LOW',      title: 'Control Assessments',                     description: 'Conduct control assessments to determine the extent to which the controls are implemented correctly and operating as intended.' },
  { nistId: 'CA-3',  family: 'CA', familyName: 'Assessment, Authorization, and Monitoring', priority: 'P1', baselineImpact: 'LOW',      title: 'Information Exchange',                    description: 'Approve and manage the exchange of information between the system and other systems using interconnection security agreements.' },
  { nistId: 'CA-5',  family: 'CA', familyName: 'Assessment, Authorization, and Monitoring', priority: 'P3', baselineImpact: 'LOW',      title: 'Plan of Action and Milestones',            description: 'Develop a plan of action and milestones for the system to document the planned remediation actions.' },
  { nistId: 'CA-6',  family: 'CA', familyName: 'Assessment, Authorization, and Monitoring', priority: 'P2', baselineImpact: 'LOW',      title: 'Authorization',                           description: 'Authorize the system or common controls to operate before commencing operations and update the authorization after major changes.' },
  { nistId: 'CA-7',  family: 'CA', familyName: 'Assessment, Authorization, and Monitoring', priority: 'P2', baselineImpact: 'LOW',      title: 'Continuous Monitoring',                   description: 'Develop and implement a system-level continuous monitoring strategy.' },
  { nistId: 'CA-9',  family: 'CA', familyName: 'Assessment, Authorization, and Monitoring', priority: 'P2', baselineImpact: 'LOW',      title: 'Internal System Connections',             description: 'Authorize internal connections of subsystems to the system.' },

  // ── CM: Configuration Management ──────────────────────────────────────────
  { nistId: 'CM-1',  family: 'CM', familyName: 'Configuration Management', priority: 'P1', baselineImpact: 'LOW',      title: 'Configuration Management Policy and Procedures', description: 'Develop and disseminate configuration management policy and procedures.' },
  { nistId: 'CM-2',  family: 'CM', familyName: 'Configuration Management', priority: 'P1', baselineImpact: 'LOW',      title: 'Baseline Configuration',                          description: 'Develop, document, and maintain under configuration control, a current baseline configuration of the system.' },
  { nistId: 'CM-3',  family: 'CM', familyName: 'Configuration Management', priority: 'P1', baselineImpact: 'MODERATE', title: 'Configuration Change Control',                    description: 'Determine the types of changes to the system that are configuration-controlled.' },
  { nistId: 'CM-4',  family: 'CM', familyName: 'Configuration Management', priority: 'P2', baselineImpact: 'LOW',      title: 'Impact Analyses',                                 description: 'Analyze changes to the system to determine potential security and privacy impacts prior to change implementation.' },
  { nistId: 'CM-5',  family: 'CM', familyName: 'Configuration Management', priority: 'P2', baselineImpact: 'MODERATE', title: 'Access Restrictions for Change',                  description: 'Define, document, approve, and enforce physical and logical access restrictions associated with changes to the system.' },
  { nistId: 'CM-6',  family: 'CM', familyName: 'Configuration Management', priority: 'P1', baselineImpact: 'LOW',      title: 'Configuration Settings',                          description: 'Establish and document configuration settings for technology products employed within the system that reflect the most restrictive mode consistent with operational requirements.' },
  { nistId: 'CM-7',  family: 'CM', familyName: 'Configuration Management', priority: 'P1', baselineImpact: 'LOW',      title: 'Least Functionality',                             description: 'Configure the system to provide only essential capabilities.' },
  { nistId: 'CM-8',  family: 'CM', familyName: 'Configuration Management', priority: 'P1', baselineImpact: 'LOW',      title: 'System Component Inventory',                      description: 'Develop and document an inventory of system components that accurately reflects the system.' },
  { nistId: 'CM-9',  family: 'CM', familyName: 'Configuration Management', priority: 'P1', baselineImpact: 'MODERATE', title: 'Configuration Management Plan',                   description: 'Develop, document, and implement a configuration management plan for the system.' },
  { nistId: 'CM-10', family: 'CM', familyName: 'Configuration Management', priority: 'P2', baselineImpact: 'LOW',      title: 'Software Usage Restrictions',                     description: 'Use software and associated documentation in accordance with contract agreements and copyright laws.' },
  { nistId: 'CM-11', family: 'CM', familyName: 'Configuration Management', priority: 'P2', baselineImpact: 'LOW',      title: 'User-Installed Software',                         description: 'Establish and document policies governing the installation of software by users.' },

  // ── CP: Contingency Planning ───────────────────────────────────────────────
  { nistId: 'CP-1',  family: 'CP', familyName: 'Contingency Planning', priority: 'P1', baselineImpact: 'LOW', title: 'Contingency Planning Policy and Procedures', description: 'Develop and disseminate contingency planning policy and procedures.' },
  { nistId: 'CP-2',  family: 'CP', familyName: 'Contingency Planning', priority: 'P1', baselineImpact: 'LOW', title: 'Contingency Plan',                           description: 'Develop a contingency plan for the system.' },
  { nistId: 'CP-3',  family: 'CP', familyName: 'Contingency Planning', priority: 'P2', baselineImpact: 'LOW', title: 'Contingency Training',                       description: 'Provide contingency training to system users consistent with assigned roles and responsibilities.' },
  { nistId: 'CP-4',  family: 'CP', familyName: 'Contingency Planning', priority: 'P2', baselineImpact: 'LOW', title: 'Contingency Plan Testing',                   description: 'Test the contingency plan for the system to determine the effectiveness of the plan.' },
  { nistId: 'CP-6',  family: 'CP', familyName: 'Contingency Planning', priority: 'P1', baselineImpact: 'MODERATE', title: 'Alternate Storage Site',             description: 'Establish an alternate storage site, including necessary agreements to permit the storage and retrieval of system backup information.' },
  { nistId: 'CP-7',  family: 'CP', familyName: 'Contingency Planning', priority: 'P1', baselineImpact: 'MODERATE', title: 'Alternate Processing Site',          description: 'Establish an alternate processing site including necessary agreements to permit the transfer and resumption of operations for essential missions and business functions.' },
  { nistId: 'CP-8',  family: 'CP', familyName: 'Contingency Planning', priority: 'P1', baselineImpact: 'MODERATE', title: 'Telecommunications Services',        description: 'Establish alternate telecommunications services to support the system.' },
  { nistId: 'CP-9',  family: 'CP', familyName: 'Contingency Planning', priority: 'P1', baselineImpact: 'LOW', title: 'System Backup',                              description: 'Conduct backups of user-level information, system-level information, and system documentation.' },
  { nistId: 'CP-10', family: 'CP', familyName: 'Contingency Planning', priority: 'P1', baselineImpact: 'LOW', title: 'System Recovery and Reconstitution',         description: 'Provide for the recovery and reconstitution of the system to a known state after disruption, compromise, or failure.' },

  // ── IA: Identification and Authentication ──────────────────────────────────
  { nistId: 'IA-1',  family: 'IA', familyName: 'Identification and Authentication', priority: 'P1', baselineImpact: 'LOW',      title: 'Identification and Authentication Policy and Procedures', description: 'Develop and disseminate identification and authentication policy and procedures.' },
  { nistId: 'IA-2',  family: 'IA', familyName: 'Identification and Authentication', priority: 'P1', baselineImpact: 'LOW',      title: 'Identification and Authentication (Organizational Users)', description: 'Uniquely identify and authenticate organizational users and associate that unique identification with processes acting on behalf of those users.' },
  { nistId: 'IA-3',  family: 'IA', familyName: 'Identification and Authentication', priority: 'P1', baselineImpact: 'MODERATE', title: 'Device Identification and Authentication',               description: 'Uniquely identify and authenticate devices before establishing connections.' },
  { nistId: 'IA-4',  family: 'IA', familyName: 'Identification and Authentication', priority: 'P1', baselineImpact: 'LOW',      title: 'Identifier Management',                                  description: 'Manage system identifiers by receiving authorization from designated personnel to assign identifiers.' },
  { nistId: 'IA-5',  family: 'IA', familyName: 'Identification and Authentication', priority: 'P1', baselineImpact: 'LOW',      title: 'Authenticator Management',                               description: 'Manage system authenticators including passwords, tokens, biometrics, PKI certificates, and key cards.' },
  { nistId: 'IA-6',  family: 'IA', familyName: 'Identification and Authentication', priority: 'P1', baselineImpact: 'LOW',      title: 'Authentication Feedback',                                description: 'Obscure feedback of authentication information during the authentication process.' },
  { nistId: 'IA-7',  family: 'IA', familyName: 'Identification and Authentication', priority: 'P1', baselineImpact: 'LOW',      title: 'Cryptographic Module Authentication',                    description: 'Implement mechanisms for authentication to a cryptographic module that meet the requirements of applicable laws, executive orders, directives, policies, regulations, standards, and guidelines for cryptographic module authentication.' },
  { nistId: 'IA-8',  family: 'IA', familyName: 'Identification and Authentication', priority: 'P1', baselineImpact: 'LOW',      title: 'Identification and Authentication (Non-Organizational Users)', description: 'Uniquely identify and authenticate non-organizational users or processes acting on behalf of non-organizational users.' },
  { nistId: 'IA-11', family: 'IA', familyName: 'Identification and Authentication', priority: 'P2', baselineImpact: 'LOW',      title: 'Re-Authentication',                                      description: 'Require users to re-authenticate when organization-defined circumstances or situations requiring re-authentication occur.' },
  { nistId: 'IA-12', family: 'IA', familyName: 'Identification and Authentication', priority: 'P1', baselineImpact: 'LOW',      title: 'Identity Proofing',                                      description: 'Manage individual identity proofing requirements as part of the identity life cycle management process.' },

  // ── IR: Incident Response ──────────────────────────────────────────────────
  { nistId: 'IR-1',  family: 'IR', familyName: 'Incident Response', priority: 'P1', baselineImpact: 'LOW', title: 'Incident Response Policy and Procedures', description: 'Develop and disseminate incident response policy and procedures.' },
  { nistId: 'IR-2',  family: 'IR', familyName: 'Incident Response', priority: 'P2', baselineImpact: 'LOW', title: 'Incident Response Training',              description: 'Provide incident response training to system users consistent with assigned roles and responsibilities.' },
  { nistId: 'IR-3',  family: 'IR', familyName: 'Incident Response', priority: 'P2', baselineImpact: 'MODERATE', title: 'Incident Response Testing',          description: 'Test the incident response capability for the system using organization-defined tests and exercises.' },
  { nistId: 'IR-4',  family: 'IR', familyName: 'Incident Response', priority: 'P1', baselineImpact: 'LOW', title: 'Incident Handling',                       description: 'Implement an incident handling capability for security incidents that includes preparation, detection and analysis, containment, eradication, and recovery.' },
  { nistId: 'IR-5',  family: 'IR', familyName: 'Incident Response', priority: 'P1', baselineImpact: 'LOW', title: 'Incident Monitoring',                     description: 'Track and document incidents.' },
  { nistId: 'IR-6',  family: 'IR', familyName: 'Incident Response', priority: 'P1', baselineImpact: 'LOW', title: 'Incident Reporting',                      description: 'Require personnel to report suspected incidents to the organizational incident response capability within the time period defined in the incident response policy.' },
  { nistId: 'IR-7',  family: 'IR', familyName: 'Incident Response', priority: 'P2', baselineImpact: 'LOW', title: 'Incident Response Assistance',            description: 'Provide an incident response support resource to offer advice and assistance to users of the system for the handling and reporting of security incidents.' },
  { nistId: 'IR-8',  family: 'IR', familyName: 'Incident Response', priority: 'P1', baselineImpact: 'LOW', title: 'Incident Response Plan',                  description: 'Develop and implement a coordinated incident response plan that covers the organizational hierarchy.' },
  { nistId: 'IR-9',  family: 'IR', familyName: 'Incident Response', priority: 'P2', baselineImpact: 'MODERATE', title: 'Information Spillage Response',      description: 'Respond to information spills by identifying the specific information involved in the system contamination.' },

  // ── MA: Maintenance ────────────────────────────────────────────────────────
  { nistId: 'MA-1',  family: 'MA', familyName: 'Maintenance', priority: 'P1', baselineImpact: 'LOW', title: 'Maintenance Policy and Procedures',         description: 'Develop and disseminate maintenance policy and procedures.' },
  { nistId: 'MA-2',  family: 'MA', familyName: 'Maintenance', priority: 'P1', baselineImpact: 'LOW', title: 'Controlled Maintenance',                    description: 'Schedule, document, and review records of maintenance and repairs on system components.' },
  { nistId: 'MA-3',  family: 'MA', familyName: 'Maintenance', priority: 'P2', baselineImpact: 'MODERATE', title: 'Maintenance Tools',                description: 'Approve, control, and monitor the use of maintenance tools.' },
  { nistId: 'MA-4',  family: 'MA', familyName: 'Maintenance', priority: 'P2', baselineImpact: 'LOW', title: 'Nonlocal Maintenance',                       description: 'Approve and monitor nonlocal maintenance and diagnostic activities.' },
  { nistId: 'MA-5',  family: 'MA', familyName: 'Maintenance', priority: 'P1', baselineImpact: 'LOW', title: 'Maintenance Personnel',                     description: 'Establish a process for maintenance personnel authorization and maintain a list of authorized maintenance organizations or personnel.' },
  { nistId: 'MA-6',  family: 'MA', familyName: 'Maintenance', priority: 'P2', baselineImpact: 'MODERATE', title: 'Timely Maintenance',                description: 'Obtain maintenance support and spare parts for organization-defined system components within a time period from the time of failure.' },

  // ── MP: Media Protection ───────────────────────────────────────────────────
  { nistId: 'MP-1',  family: 'MP', familyName: 'Media Protection', priority: 'P1', baselineImpact: 'LOW', title: 'Media Protection Policy and Procedures', description: 'Develop and disseminate media protection policy and procedures.' },
  { nistId: 'MP-2',  family: 'MP', familyName: 'Media Protection', priority: 'P1', baselineImpact: 'LOW', title: 'Media Access',                           description: 'Restrict access to digital and non-digital media to authorized individuals.' },
  { nistId: 'MP-3',  family: 'MP', familyName: 'Media Protection', priority: 'P2', baselineImpact: 'MODERATE', title: 'Media Marking',                  description: 'Mark system media indicating the distribution limitations, handling caveats, and applicable security markings of the information.' },
  { nistId: 'MP-4',  family: 'MP', familyName: 'Media Protection', priority: 'P1', baselineImpact: 'MODERATE', title: 'Media Storage',                  description: 'Physically control and securely store digital and non-digital media containing CUI within controlled areas.' },
  { nistId: 'MP-5',  family: 'MP', familyName: 'Media Protection', priority: 'P1', baselineImpact: 'MODERATE', title: 'Media Transport',                description: 'Protect and control digital and non-digital media containing CUI during transport outside controlled areas.' },
  { nistId: 'MP-6',  family: 'MP', familyName: 'Media Protection', priority: 'P1', baselineImpact: 'LOW',      title: 'Media Sanitization',             description: 'Sanitize digital and non-digital system media prior to disposal, release out of organizational control, or release for reuse.' },
  { nistId: 'MP-7',  family: 'MP', familyName: 'Media Protection', priority: 'P1', baselineImpact: 'LOW',      title: 'Media Use',                      description: 'Restrict or prohibit the use of portable storage devices on external systems.' },

  // ── PE: Physical and Environmental Protection ──────────────────────────────
  { nistId: 'PE-1',  family: 'PE', familyName: 'Physical and Environmental Protection', priority: 'P1', baselineImpact: 'LOW', title: 'Physical and Environmental Protection Policy and Procedures', description: 'Develop and disseminate physical and environmental protection policy and procedures.' },
  { nistId: 'PE-2',  family: 'PE', familyName: 'Physical and Environmental Protection', priority: 'P1', baselineImpact: 'LOW', title: 'Physical Access Authorizations', description: 'Develop, approve, and maintain a list of individuals with authorized access to the facility where the system resides.' },
  { nistId: 'PE-3',  family: 'PE', familyName: 'Physical and Environmental Protection', priority: 'P1', baselineImpact: 'LOW', title: 'Physical Access Control',        description: 'Enforce physical access authorizations at all physical access points to the facility where the system resides.' },
  { nistId: 'PE-4',  family: 'PE', familyName: 'Physical and Environmental Protection', priority: 'P1', baselineImpact: 'MODERATE', title: 'Access Control for Transmission',  description: 'Control physical access to system distribution and transmission lines within organizational facilities.' },
  { nistId: 'PE-5',  family: 'PE', familyName: 'Physical and Environmental Protection', priority: 'P1', baselineImpact: 'MODERATE', title: 'Access Control for Output Devices', description: 'Control physical access to output devices to prevent unauthorized individuals from obtaining the output.' },
  { nistId: 'PE-6',  family: 'PE', familyName: 'Physical and Environmental Protection', priority: 'P1', baselineImpact: 'LOW',      title: 'Monitoring Physical Access',       description: 'Monitor physical access to the facility where the system resides to detect and respond to physical security incidents.' },
  { nistId: 'PE-8',  family: 'PE', familyName: 'Physical and Environmental Protection', priority: 'P3', baselineImpact: 'LOW',      title: 'Visitor Access Records',           description: 'Maintain visitor access records to the facility where the system resides for a defined time period.' },
  { nistId: 'PE-9',  family: 'PE', familyName: 'Physical and Environmental Protection', priority: 'P1', baselineImpact: 'LOW',      title: 'Power Equipment and Cabling',      description: 'Protect power equipment and power cabling for the system from damage and destruction.' },
  { nistId: 'PE-10', family: 'PE', familyName: 'Physical and Environmental Protection', priority: 'P1', baselineImpact: 'MODERATE', title: 'Emergency Shutoff',                description: 'Provide the capability of shutting off power to the system or individual system components in emergency situations.' },
  { nistId: 'PE-12', family: 'PE', familyName: 'Physical and Environmental Protection', priority: 'P1', baselineImpact: 'LOW',      title: 'Emergency Lighting',               description: 'Employ and maintain automatic emergency lighting for the system that activates in the event of a power outage or disruption.' },
  { nistId: 'PE-13', family: 'PE', familyName: 'Physical and Environmental Protection', priority: 'P1', baselineImpact: 'LOW',      title: 'Fire Protection',                  description: 'Employ and maintain fire detection and suppression systems that are supported by an independent energy source.' },
  { nistId: 'PE-14', family: 'PE', familyName: 'Physical and Environmental Protection', priority: 'P1', baselineImpact: 'LOW',      title: 'Environmental Controls',           description: 'Maintain the temperature and humidity levels within the facility where the system resides at the levels required to protect the system.' },
  { nistId: 'PE-16', family: 'PE', familyName: 'Physical and Environmental Protection', priority: 'P2', baselineImpact: 'LOW',      title: 'Delivery and Removal',             description: 'Authorize and control information system-related items entering and exiting the facility.' },
  { nistId: 'PE-17', family: 'PE', familyName: 'Physical and Environmental Protection', priority: 'P2', baselineImpact: 'MODERATE', title: 'Alternate Work Site',              description: 'Implement the required management, operational, and technical controls for alternate work sites.' },

  // ── PL: Planning ───────────────────────────────────────────────────────────
  { nistId: 'PL-1',  family: 'PL', familyName: 'Planning', priority: 'P1', baselineImpact: 'LOW', title: 'Planning Policy and Procedures',  description: 'Develop and disseminate planning policy and procedures.' },
  { nistId: 'PL-2',  family: 'PL', familyName: 'Planning', priority: 'P1', baselineImpact: 'LOW', title: 'System Security and Privacy Plans', description: 'Develop and implement security and privacy plans for the system.' },
  { nistId: 'PL-4',  family: 'PL', familyName: 'Planning', priority: 'P1', baselineImpact: 'LOW', title: 'Rules of Behavior',                description: 'Establish and provide to individuals requiring access to the system rules that describe responsibilities and expected behavior.' },
  { nistId: 'PL-8',  family: 'PL', familyName: 'Planning', priority: 'P1', baselineImpact: 'MODERATE', title: 'Security and Privacy Architectures', description: 'Develop and maintain security and privacy architectures that reflect applicable laws and organizational policies.' },
  { nistId: 'PL-10', family: 'PL', familyName: 'Planning', priority: 'P2', baselineImpact: 'MODERATE', title: 'Baseline Selection', description: 'Select a control baseline for the system.' },

  // ── PM: Program Management ─────────────────────────────────────────────────
  { nistId: 'PM-1',  family: 'PM', familyName: 'Program Management', priority: 'P1', baselineImpact: 'LOW', title: 'Information Security Program Plan',      description: 'Develop and disseminate an organization-wide information security program plan.' },
  { nistId: 'PM-2',  family: 'PM', familyName: 'Program Management', priority: 'P1', baselineImpact: 'LOW', title: 'Information Security Program Leadership', description: 'Appoint a senior agency information security officer with the mission and resources to coordinate, develop, implement, and maintain an organization-wide information security program.' },
  { nistId: 'PM-3',  family: 'PM', familyName: 'Program Management', priority: 'P1', baselineImpact: 'LOW', title: 'Information Security and Privacy Resources', description: 'Include the resources needed to implement the information security and privacy programs in capital planning and investment requests.' },
  { nistId: 'PM-5',  family: 'PM', familyName: 'Program Management', priority: 'P1', baselineImpact: 'LOW', title: 'System Inventory',                        description: 'Develop and maintain an inventory of organizational systems.' },
  { nistId: 'PM-9',  family: 'PM', familyName: 'Program Management', priority: 'P1', baselineImpact: 'LOW', title: 'Risk Management Strategy',               description: 'Develop a comprehensive strategy to manage security and privacy risk to organizational operations, assets, individuals, and other organizations.' },
  { nistId: 'PM-10', family: 'PM', familyName: 'Program Management', priority: 'P2', baselineImpact: 'LOW', title: 'Authorization Process',                  description: 'Manage the security state of organizational systems through authorization processes.' },
  { nistId: 'PM-14', family: 'PM', familyName: 'Program Management', priority: 'P2', baselineImpact: 'LOW', title: 'Testing, Training, and Monitoring',       description: 'Implement a process to test, evaluate, and monitor security programs and controls.' },

  // ── PS: Personnel Security ─────────────────────────────────────────────────
  { nistId: 'PS-1',  family: 'PS', familyName: 'Personnel Security', priority: 'P1', baselineImpact: 'LOW', title: 'Personnel Security Policy and Procedures', description: 'Develop and disseminate personnel security policy and procedures.' },
  { nistId: 'PS-2',  family: 'PS', familyName: 'Personnel Security', priority: 'P1', baselineImpact: 'LOW', title: 'Position Risk Designation',                description: 'Assign a risk designation to all organizational positions and establish screening criteria for individuals filling those positions.' },
  { nistId: 'PS-3',  family: 'PS', familyName: 'Personnel Security', priority: 'P1', baselineImpact: 'LOW', title: 'Personnel Screening',                      description: 'Screen individuals prior to authorizing access to the system.' },
  { nistId: 'PS-4',  family: 'PS', familyName: 'Personnel Security', priority: 'P1', baselineImpact: 'LOW', title: 'Personnel Termination',                    description: 'Upon termination of individual employment, disable system access within a defined time period and retrieve all security-related organizational property.' },
  { nistId: 'PS-5',  family: 'PS', familyName: 'Personnel Security', priority: 'P2', baselineImpact: 'LOW', title: 'Personnel Transfer',                       description: 'Review and confirm ongoing operational need for current logical and physical access authorizations when individuals are reassigned or transferred.' },
  { nistId: 'PS-6',  family: 'PS', familyName: 'Personnel Security', priority: 'P1', baselineImpact: 'LOW', title: 'Access Agreements',                        description: 'Develop and document access agreements for organizational systems and review and update agreements when individuals are assigned different responsibilities.' },
  { nistId: 'PS-7',  family: 'PS', familyName: 'Personnel Security', priority: 'P1', baselineImpact: 'LOW', title: 'External Personnel Security',              description: 'Establish personnel security requirements, including security roles and responsibilities for external providers.' },
  { nistId: 'PS-8',  family: 'PS', familyName: 'Personnel Security', priority: 'P3', baselineImpact: 'LOW', title: 'Personnel Sanctions',                      description: 'Employ a formal sanctions process for individuals failing to comply with established information security policies and procedures.' },

  // ── PT: PII Processing and Transparency ───────────────────────────────────
  { nistId: 'PT-1',  family: 'PT', familyName: 'PII Processing and Transparency', priority: 'P1', baselineImpact: 'LOW', title: 'PII Processing and Transparency Policy and Procedures', description: 'Develop and disseminate a policy on PII processing and transparency.' },
  { nistId: 'PT-2',  family: 'PT', familyName: 'PII Processing and Transparency', priority: 'P1', baselineImpact: 'LOW', title: 'Authority to Process PII',                               description: 'Determine and document the legal authority that permits the collection, use, maintenance, and sharing of PII.' },
  { nistId: 'PT-3',  family: 'PT', familyName: 'PII Processing and Transparency', priority: 'P1', baselineImpact: 'LOW', title: 'Personally Identifiable Information Processing Purposes', description: 'Identify and document the purpose for processing PII.' },
  { nistId: 'PT-5',  family: 'PT', familyName: 'PII Processing and Transparency', priority: 'P1', baselineImpact: 'LOW', title: 'Privacy Notice',                                         description: 'Provide notice to individuals about the processing of PII that accurately describes the PII elements and the purpose of processing.' },
  { nistId: 'PT-6',  family: 'PT', familyName: 'PII Processing and Transparency', priority: 'P1', baselineImpact: 'LOW', title: 'System of Records Notice',                               description: 'For systems that process information that will be maintained in a Privacy Act system of records, draft Privacy Act notices in coordination with legal counsel.' },

  // ── RA: Risk Assessment ────────────────────────────────────────────────────
  { nistId: 'RA-1',  family: 'RA', familyName: 'Risk Assessment', priority: 'P1', baselineImpact: 'LOW', title: 'Risk Assessment Policy and Procedures', description: 'Develop and disseminate risk assessment policy and procedures.' },
  { nistId: 'RA-2',  family: 'RA', familyName: 'Risk Assessment', priority: 'P1', baselineImpact: 'LOW', title: 'Security Categorization',               description: 'Categorize the system and information it processes, stores, and transmits.' },
  { nistId: 'RA-3',  family: 'RA', familyName: 'Risk Assessment', priority: 'P1', baselineImpact: 'LOW', title: 'Risk Assessment',                        description: 'Conduct a risk assessment to determine threats and vulnerabilities to the system, and the resulting risk to organizational operations and assets.' },
  { nistId: 'RA-5',  family: 'RA', familyName: 'Risk Assessment', priority: 'P1', baselineImpact: 'LOW', title: 'Vulnerability Monitoring and Scanning',  description: 'Monitor and scan for vulnerabilities in the system and hosted applications periodically and when new vulnerabilities potentially affecting the system are identified.' },
  { nistId: 'RA-7',  family: 'RA', familyName: 'Risk Assessment', priority: 'P1', baselineImpact: 'LOW', title: 'Risk Response',                          description: 'Respond to findings from security assessments, monitoring, and vulnerability scanning.' },
  { nistId: 'RA-9',  family: 'RA', familyName: 'Risk Assessment', priority: 'P2', baselineImpact: 'MODERATE', title: 'Criticality Analysis', description: 'Identify critical system components and functions by performing a criticality analysis.' },

  // ── SA: System and Services Acquisition ───────────────────────────────────
  { nistId: 'SA-1',  family: 'SA', familyName: 'System and Services Acquisition', priority: 'P1', baselineImpact: 'LOW', title: 'System and Services Acquisition Policy and Procedures', description: 'Develop and disseminate system and services acquisition policy and procedures.' },
  { nistId: 'SA-2',  family: 'SA', familyName: 'System and Services Acquisition', priority: 'P1', baselineImpact: 'LOW', title: 'Allocation of Resources',                                description: 'Determine the high-level information security requirements for the system or system service in mission and business process planning.' },
  { nistId: 'SA-3',  family: 'SA', familyName: 'System and Services Acquisition', priority: 'P1', baselineImpact: 'LOW', title: 'System Development Life Cycle',                         description: 'Acquire, develop, and manage the system using an organization-defined system development life cycle that incorporates information security considerations.' },
  { nistId: 'SA-4',  family: 'SA', familyName: 'System and Services Acquisition', priority: 'P1', baselineImpact: 'LOW', title: 'Acquisition Process',                                   description: 'Include security and privacy requirements in acquisition contracts and agreements.' },
  { nistId: 'SA-5',  family: 'SA', familyName: 'System and Services Acquisition', priority: 'P2', baselineImpact: 'LOW', title: 'System Documentation',                                  description: 'Obtain or develop administrator documentation for the system, system component, or system service.' },
  { nistId: 'SA-8',  family: 'SA', familyName: 'System and Services Acquisition', priority: 'P1', baselineImpact: 'MODERATE', title: 'Security and Privacy Engineering Principles', description: 'Apply organization-defined systems security engineering principles in the specification, design, development, implementation, and modification of the system.' },
  { nistId: 'SA-9',  family: 'SA', familyName: 'System and Services Acquisition', priority: 'P1', baselineImpact: 'LOW', title: 'External System Services',                              description: 'Require that providers of external system services comply with organizational security and privacy requirements and employ the following controls.' },
  { nistId: 'SA-10', family: 'SA', familyName: 'System and Services Acquisition', priority: 'P1', baselineImpact: 'MODERATE', title: 'Developer Configuration Management', description: 'Require the developer of the system, system component, or system service to manage and control all changes to the item under development.' },
  { nistId: 'SA-11', family: 'SA', familyName: 'System and Services Acquisition', priority: 'P1', baselineImpact: 'MODERATE', title: 'Developer Testing and Evaluation', description: 'Require the developer of the system, system component, or system service to implement a security and privacy assessment plan.' },

  // ── SC: System and Communications Protection ───────────────────────────────
  { nistId: 'SC-1',  family: 'SC', familyName: 'System and Communications Protection', priority: 'P1', baselineImpact: 'LOW',      title: 'System and Communications Protection Policy and Procedures', description: 'Develop and disseminate system and communications protection policy and procedures.' },
  { nistId: 'SC-2',  family: 'SC', familyName: 'System and Communications Protection', priority: 'P1', baselineImpact: 'MODERATE', title: 'Separation of System and User Functionality',                 description: 'Separate user functionality (including user interface services) from system management functionality.' },
  { nistId: 'SC-3',  family: 'SC', familyName: 'System and Communications Protection', priority: 'P1', baselineImpact: 'HIGH',     title: 'Security Function Isolation',                                description: 'Isolate security functions from nonsecurity functions.' },
  { nistId: 'SC-4',  family: 'SC', familyName: 'System and Communications Protection', priority: 'P1', baselineImpact: 'MODERATE', title: 'Information in Shared System Resources',                     description: 'Prevent unauthorized and unintended information transfer via shared system resources.' },
  { nistId: 'SC-5',  family: 'SC', familyName: 'System and Communications Protection', priority: 'P1', baselineImpact: 'LOW',      title: 'Denial of Service Protection',                               description: 'Protect against or limit the effects of denial-of-service attacks.' },
  { nistId: 'SC-7',  family: 'SC', familyName: 'System and Communications Protection', priority: 'P1', baselineImpact: 'LOW',      title: 'Boundary Protection',                                        description: 'Monitor and control communications at the external boundary of the system and at key internal boundaries within the system.' },
  { nistId: 'SC-8',  family: 'SC', familyName: 'System and Communications Protection', priority: 'P1', baselineImpact: 'MODERATE', title: 'Transmission Confidentiality and Integrity',                 description: 'Implement cryptographic mechanisms to prevent unauthorized disclosure of information and detect changes to information during transmission.' },
  { nistId: 'SC-10', family: 'SC', familyName: 'System and Communications Protection', priority: 'P2', baselineImpact: 'MODERATE', title: 'Network Disconnect',                                          description: 'Terminate the network connection associated with a communications session at the end of the session or after a defined time period of inactivity.' },
  { nistId: 'SC-12', family: 'SC', familyName: 'System and Communications Protection', priority: 'P1', baselineImpact: 'LOW',      title: 'Cryptographic Key Establishment and Management',             description: 'Establish and manage cryptographic keys when cryptography is employed within the system.' },
  { nistId: 'SC-13', family: 'SC', familyName: 'System and Communications Protection', priority: 'P1', baselineImpact: 'LOW',      title: 'Cryptographic Protection',                                   description: 'Implement the following types of cryptography for the indicated cryptographic uses: organization-defined types of cryptography.' },
  { nistId: 'SC-15', family: 'SC', familyName: 'System and Communications Protection', priority: 'P1', baselineImpact: 'LOW',      title: 'Collaborative Computing Devices and Applications',           description: 'Prohibit remote activation of collaborative computing devices and applications with exceptions.' },
  { nistId: 'SC-17', family: 'SC', familyName: 'System and Communications Protection', priority: 'P1', baselineImpact: 'LOW',      title: 'Public Key Infrastructure Certificates',                     description: 'Issue public key certificates under an organization-defined certificate policy or obtain public key certificates from an approved service provider.' },
  { nistId: 'SC-18', family: 'SC', familyName: 'System and Communications Protection', priority: 'P2', baselineImpact: 'MODERATE', title: 'Mobile Code',                                                 description: 'Define acceptable and unacceptable mobile code and mobile code technologies.' },
  { nistId: 'SC-20', family: 'SC', familyName: 'System and Communications Protection', priority: 'P1', baselineImpact: 'LOW',      title: 'Secure Name/Address Resolution Service (Authoritative Source)', description: 'Provide additional data origin authentication and integrity verification artifacts along with the authoritative name resolution data the system returns in response to external name/address resolution queries.' },
  { nistId: 'SC-28', family: 'SC', familyName: 'System and Communications Protection', priority: 'P1', baselineImpact: 'MODERATE', title: 'Protection of Information at Rest',                           description: 'Protect the confidentiality and integrity of information at rest.' },
  { nistId: 'SC-39', family: 'SC', familyName: 'System and Communications Protection', priority: 'P1', baselineImpact: 'LOW',      title: 'Process Isolation',                                          description: 'Maintain a separate execution domain for each executing system process.' },

  // ── SI: System and Information Integrity ───────────────────────────────────
  { nistId: 'SI-1',  family: 'SI', familyName: 'System and Information Integrity', priority: 'P1', baselineImpact: 'LOW',      title: 'System and Information Integrity Policy and Procedures', description: 'Develop and disseminate system and information integrity policy and procedures.' },
  { nistId: 'SI-2',  family: 'SI', familyName: 'System and Information Integrity', priority: 'P1', baselineImpact: 'LOW',      title: 'Flaw Remediation',                                       description: 'Identify, report, and correct information system flaws; test software and firmware updates related to flaw remediation for effectiveness and potential side effects before installation; install security-relevant software updates within organization-defined time period.' },
  { nistId: 'SI-3',  family: 'SI', familyName: 'System and Information Integrity', priority: 'P1', baselineImpact: 'LOW',      title: 'Malicious Code Protection',                             description: 'Implement malicious code protection mechanisms at system entry and exit points to detect and eradicate malicious code.' },
  { nistId: 'SI-4',  family: 'SI', familyName: 'System and Information Integrity', priority: 'P1', baselineImpact: 'LOW',      title: 'System Monitoring',                                      description: 'Monitor the system to detect attacks and indicators of potential attacks in accordance with monitoring objectives.' },
  { nistId: 'SI-5',  family: 'SI', familyName: 'System and Information Integrity', priority: 'P1', baselineImpact: 'LOW',      title: 'Security Alerts, Advisories, and Directives',           description: 'Receive system security alerts, advisories, and directives from organization-defined external organizations on an ongoing basis.' },
  { nistId: 'SI-6',  family: 'SI', familyName: 'System and Information Integrity', priority: 'P1', baselineImpact: 'HIGH',     title: 'Security and Privacy Function Verification',            description: 'Verify the correct operation of security and privacy functions.' },
  { nistId: 'SI-7',  family: 'SI', familyName: 'System and Information Integrity', priority: 'P1', baselineImpact: 'MODERATE', title: 'Software, Firmware, and Information Integrity',          description: 'Employ integrity verification tools to detect unauthorized changes to the system.' },
  { nistId: 'SI-8',  family: 'SI', familyName: 'System and Information Integrity', priority: 'P2', baselineImpact: 'MODERATE', title: 'Spam Protection',                                        description: 'Employ spam protection mechanisms at system entry and exit points and at workstations, servers, or mobile computing devices on the network.' },
  { nistId: 'SI-10', family: 'SI', familyName: 'System and Information Integrity', priority: 'P1', baselineImpact: 'MODERATE', title: 'Information Input Validation',                           description: 'Check the validity of the inputs to organization-defined system components.' },
  { nistId: 'SI-11', family: 'SI', familyName: 'System and Information Integrity', priority: 'P2', baselineImpact: 'MODERATE', title: 'Error Handling',                                         description: 'Generate error messages that provide information necessary for corrective actions without revealing information that could be exploited.' },
  { nistId: 'SI-12', family: 'SI', familyName: 'System and Information Integrity', priority: 'P2', baselineImpact: 'LOW',      title: 'Information Management and Retention',                  description: 'Manage and retain information within the system and information output from the system in accordance with applicable laws, executive orders, directives, regulations, policies, standards, guidelines, and operational requirements.' },
  { nistId: 'SI-16', family: 'SI', familyName: 'System and Information Integrity', priority: 'P1', baselineImpact: 'MODERATE', title: 'Memory Protection',                                      description: 'Implement the following controls to protect the system memory from unauthorized code execution: organization-defined controls.' },

  // ── SR: Supply Chain Risk Management ──────────────────────────────────────
  { nistId: 'SR-1',  family: 'SR', familyName: 'Supply Chain Risk Management', priority: 'P1', baselineImpact: 'LOW',      title: 'Supply Chain Risk Management Policy and Procedures', description: 'Develop and disseminate supply chain risk management policy and procedures.' },
  { nistId: 'SR-2',  family: 'SR', familyName: 'Supply Chain Risk Management', priority: 'P1', baselineImpact: 'LOW',      title: 'Supply Chain Risk Management Plan',                  description: 'Develop, document, and disseminate a supply chain risk management plan that addresses risks associated with the development, acquisition, maintenance, and disposal of systems, system components, and system services.' },
  { nistId: 'SR-3',  family: 'SR', familyName: 'Supply Chain Risk Management', priority: 'P1', baselineImpact: 'LOW',      title: 'Supply Chain Controls and Processes',                description: 'Establish a process or processes to identify and address weaknesses or deficiencies in the supply chain elements and processes of concern.' },
  { nistId: 'SR-5',  family: 'SR', familyName: 'Supply Chain Risk Management', priority: 'P1', baselineImpact: 'LOW',      title: 'Acquisition Strategies, Tools, and Methods',         description: 'Employ acquisition strategies, contract tools, and procurement methods to protect against, identify, and mitigate supply chain risks throughout the system development life cycle.' },
  { nistId: 'SR-6',  family: 'SR', familyName: 'Supply Chain Risk Management', priority: 'P1', baselineImpact: 'MODERATE', title: 'Supplier Assessments and Reviews',                   description: 'Assess and review the supply chain-related risks associated with suppliers or contractors and the system, system component, or system service they provide.' },
  { nistId: 'SR-8',  family: 'SR', familyName: 'Supply Chain Risk Management', priority: 'P1', baselineImpact: 'MODERATE', title: 'Notification Agreements',                             description: 'Establish agreements and procedures with entities involved in the supply chain for the system, system component, or system service for notifying individuals of security incidents.' },
  { nistId: 'SR-10', family: 'SR', familyName: 'Supply Chain Risk Management', priority: 'P2', baselineImpact: 'MODERATE', title: 'Inspection of Systems or Components',                description: 'Inspect systems, system components, or services of supply chain elements and processes.' },
  { nistId: 'SR-11', family: 'SR', familyName: 'Supply Chain Risk Management', priority: 'P1', baselineImpact: 'MODERATE', title: 'Component Authenticity',                              description: 'Develop and implement anti-counterfeit policy and procedures that include the means to detect and prevent counterfeit components from entering the system.' },
]

async function seedNist() {
  console.log('🌱 Starting NIST 800-53 Rev 5 seed...')

  try {
    // Check if already seeded
    const existing = await db.select({ count: sql<number>`count(*)` }).from(canonicalControls)
    const count = Number(existing[0].count)

    if (count > 0) {
      console.log(`ℹ️  canonical_controls already has ${count} rows — skipping seed.`)
      console.log('   To re-seed, truncate the table first: DELETE FROM canonical_controls;')
      await client.end()
      return
    }

    // Insert in batches of 50
    const BATCH_SIZE = 50
    let inserted = 0

    for (let i = 0; i < NIST_CONTROLS.length; i += BATCH_SIZE) {
      const batch = NIST_CONTROLS.slice(i, i + BATCH_SIZE)
      await db.insert(canonicalControls).values(
        batch.map((c) => ({
          nistId: c.nistId,
          family: c.family,
          familyName: c.familyName,
          title: c.title,
          description: c.description,
          priority: c.priority,
          baselineImpact: c.baselineImpact,
          isEnhancement: c.nistId.includes('('),
          parentNistId: c.nistId.includes('(') ? c.nistId.split('(')[0].trim() : null,
        }))
      )
      inserted += batch.length
      console.log(`   ✓ Inserted ${inserted}/${NIST_CONTROLS.length} controls...`)
    }

    console.log(`\n✅ NIST 800-53 Rev 5 seed complete!`)
    console.log(`   Total controls: ${inserted}`)

    // Print family summary
    const families = new Map<string, number>()
    for (const c of NIST_CONTROLS) {
      families.set(c.family, (families.get(c.family) ?? 0) + 1)
    }
    console.log('\n📊 Controls by family:')
    for (const [family, cnt] of Array.from(families.entries()).sort()) {
      console.log(`   ${family.padEnd(4)} — ${cnt} controls`)
    }
  } catch (err) {
    console.error('❌ Seed failed:', err)
    throw err
  } finally {
    await client.end()
  }
}

seedNist().catch(() => process.exit(1))
