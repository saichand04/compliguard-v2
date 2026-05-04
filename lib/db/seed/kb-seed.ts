/**
 * Knowledge Base seed data — 20 GRC articles
 * Run: npx ts-node lib/db/seed/kb-seed.ts
 */

import { db } from '@/lib/db'
import { knowledgeBaseEntries } from '@/lib/db/schema'

const ARTICLES = [
  {
    title: 'NIST 800-53 Overview: Security and Privacy Controls for Information Systems',
    category: 'frameworks',
    tags: ['NIST', '800-53', 'federal', 'security controls', 'privacy'],
    content: `NIST Special Publication 800-53 provides a comprehensive catalog of security and privacy controls for federal information systems and organizations. Published by the National Institute of Standards and Technology, it serves as the foundational reference for organizations implementing the Risk Management Framework (RMF).

The publication organizes controls into 20 control families, each addressing a specific area of security or privacy. These families include Access Control (AC), Audit and Accountability (AU), Configuration Management (CM), Contingency Planning (CP), Identification and Authentication (IA), Incident Response (IR), and many others. Each control is described with a base control statement, supplemental guidance, control enhancements, and references.

NIST 800-53 Revision 5, released in September 2020, introduced significant changes including the integration of privacy controls, outcomes-based control statements, and a new supply chain risk management family. The revision also removed the distinction between "federal" and "non-federal" systems, making the controls applicable to all organizations, not just government agencies.

Organizations implementing NIST 800-53 typically follow the RMF process: categorize the system, select appropriate controls based on system categorization, implement the controls, assess their effectiveness, authorize system operation, and continuously monitor the controls over time.

Control baselines — Low, Moderate, and High — help organizations select the minimum required controls based on the potential impact of a security breach. Low-impact systems require the fewest controls, while High-impact systems require the most comprehensive set. Organizations should tailor these baselines based on their specific threat environment, mission requirements, and risk tolerance.

The catalog is freely available from NIST and has been widely adopted beyond the federal government, serving as the basis for many compliance frameworks including FedRAMP, FISMA, and CMMC. Understanding NIST 800-53 is essential for any organization working with federal agencies or seeking to implement a comprehensive security control framework.`,
  },
  {
    title: 'SOC 2 Type II: A Complete Implementation Guide for Service Organizations',
    category: 'compliance',
    tags: ['SOC 2', 'Type II', 'AICPA', 'trust services', 'audit'],
    content: `SOC 2 (System and Organization Controls 2) is an auditing standard developed by the American Institute of Certified Public Accountants (AICPA) that evaluates service organizations' information systems relevant to security, availability, processing integrity, confidentiality, and privacy. A SOC 2 Type II report covers the operational effectiveness of controls over a period, typically 6 to 12 months.

The five Trust Services Criteria (TSC) form the basis of SOC 2: Security is the only required criteria, while Availability, Processing Integrity, Confidentiality, and Privacy are optional depending on the services provided. Most SaaS companies seeking SOC 2 certification include Security and Availability at minimum.

The Security criteria is organized around the Common Criteria (CC) framework, covering logical and physical access controls, change management, risk management, monitoring activities, and vendor management. Organizations must demonstrate that their controls are designed appropriately AND operating effectively throughout the audit period.

Preparing for SOC 2 Type II typically takes 6 to 18 months depending on organizational maturity. The process involves defining scope, conducting a readiness assessment, implementing missing controls, collecting evidence for 6+ months, and engaging a licensed CPA firm for the audit. Key areas to address include access reviews, vulnerability management, change management procedures, business continuity planning, and security awareness training.

Common challenges include maintaining consistent evidence collection, managing vendor assessments, ensuring all employees complete security training, and keeping policies up to date. Automation tools and GRC platforms significantly reduce the manual burden of evidence collection and control monitoring.

Once achieved, a SOC 2 Type II report provides strong assurance to enterprise customers that the organization takes security seriously. The report typically includes the auditor's opinion, management's description of the system, and a detailed listing of controls tested. Annual renewal requires continuous monitoring and another audit period.`,
  },
  {
    title: 'GDPR Compliance Checklist: Data Protection for Organizations',
    category: 'compliance',
    tags: ['GDPR', 'data protection', 'EU', 'privacy', 'personal data'],
    content: `The General Data Protection Regulation (GDPR) is a comprehensive data protection law that applies to organizations processing personal data of individuals in the European Union, regardless of where the organization is located. Enacted in May 2018, GDPR replaced the 1995 EU Data Protection Directive and introduced significantly stricter requirements and penalties.

Key principles under GDPR include lawfulness, fairness, and transparency; purpose limitation; data minimization; accuracy; storage limitation; integrity and confidentiality; and accountability. Organizations must be able to demonstrate compliance with all six principles through documentation and controls.

Lawful bases for processing personal data include consent, contract necessity, legal obligation, vital interests, public task, and legitimate interests. Organizations must identify and document the lawful basis for each processing activity. Consent must be freely given, specific, informed, and unambiguous — pre-ticked boxes do not constitute valid consent.

Data subject rights are a cornerstone of GDPR compliance. Organizations must be able to respond to requests for access, rectification, erasure (right to be forgotten), data portability, restriction of processing, and objection. Response deadlines are typically one month, extendable by two more months for complex requests.

Data Protection Impact Assessments (DPIAs) are required for high-risk processing activities, such as systematic profiling, large-scale processing of sensitive data, or systematic monitoring of public areas. Organizations must appoint a Data Protection Officer (DPO) if they process data on a large scale as a core activity or process special category data.

Data breach notification requirements mandate reporting breaches likely to risk individuals' rights to the supervisory authority within 72 hours of discovery. Breaches likely to result in high risk to individuals must also be communicated directly to affected data subjects without undue delay.

International data transfers require appropriate safeguards such as Standard Contractual Clauses (SCCs), Binding Corporate Rules, or transfers to countries with an adequacy decision. Penalties for non-compliance can reach €20 million or 4% of global annual turnover, whichever is higher.`,
  },
  {
    title: 'ISO 27001 Implementation: Building an Information Security Management System',
    category: 'frameworks',
    tags: ['ISO 27001', 'ISMS', 'information security', 'certification', 'risk management'],
    content: `ISO/IEC 27001 is the internationally recognized standard for establishing, implementing, maintaining, and continually improving an Information Security Management System (ISMS). Published jointly by the International Organization for Standardization (ISO) and the International Electrotechnical Commission (IEC), it provides a systematic approach to managing sensitive company information through risk-based security controls.

The standard follows the Plan-Do-Check-Act (PDCA) cycle and is structured around ten clauses: Context of the Organization, Leadership, Planning, Support, Operation, Performance Evaluation, and Improvement. These clauses define the requirements for the ISMS itself. Annex A provides 93 controls organized into four themes: Organizational, People, Physical, and Technological.

Implementation begins with defining the scope of the ISMS — determining which assets, processes, and locations are covered. Organizations then conduct a comprehensive information security risk assessment to identify threats and vulnerabilities, assess likelihood and impact, and determine the risk appetite. This drives selection of appropriate controls from Annex A.

A Statement of Applicability (SOA) is a mandatory document that lists all 93 Annex A controls with justification for inclusion or exclusion. The SOA demonstrates that control selection is risk-driven and comprehensive. Organizations also develop a risk treatment plan documenting how each identified risk will be addressed.

Achieving ISO 27001 certification requires a two-stage audit by an accredited certification body. Stage 1 reviews documentation and readiness; Stage 2 assesses implementation effectiveness. Certification is valid for three years, with annual surveillance audits to verify continued compliance.

Key success factors include top management commitment, clear ownership of the ISMS program, regular internal audits, management reviews, and a culture of continuous improvement. Organizations that achieve certification signal to customers, partners, and regulators that they have implemented robust and verifiable information security practices.`,
  },
  {
    title: 'PCI DSS Requirements: Protecting Payment Card Industry Data',
    category: 'compliance',
    tags: ['PCI DSS', 'payment', 'credit card', 'cardholder data', 'compliance'],
    content: `The Payment Card Industry Data Security Standard (PCI DSS) is a set of security standards designed to ensure that all companies that accept, process, store, or transmit credit card information maintain a secure environment. Administered by the PCI Security Standards Council (PCI SSC), which was founded by Visa, Mastercard, American Express, Discover, and JCB, PCI DSS applies to any entity that handles cardholder data.

PCI DSS v4.0, released in March 2022 with a compliance deadline of March 2024, is organized around six goals and twelve high-level requirements. The goals address building and maintaining a secure network, protecting cardholder data, maintaining a vulnerability management program, implementing strong access control measures, regularly monitoring and testing networks, and maintaining an information security policy.

The twelve requirements cover installing and maintaining firewalls, not using vendor-supplied defaults for passwords, protecting stored cardholder data, encrypting transmission of cardholder data across open networks, using and regularly updating anti-virus software, developing and maintaining secure systems, restricting access to cardholder data by business need-to-know, assigning unique IDs to each person with computer access, restricting physical access to cardholder data, tracking and monitoring all access to network resources, regularly testing security systems, and maintaining an information security policy.

Organizations are classified into four merchant levels based on annual transaction volume, which determines validation requirements. Level 1 merchants (over 6 million transactions annually) require an annual Report on Compliance (ROC) by a Qualified Security Assessor (QSA). Lower-level merchants may complete a Self-Assessment Questionnaire (SAQ) appropriate for their environment type.

Scope reduction is a critical strategy for PCI DSS compliance. Organizations can reduce compliance scope through network segmentation to isolate the cardholder data environment (CDE), tokenization to replace sensitive data with non-sensitive tokens, and point-to-point encryption (P2PE) to encrypt data from the point of interaction.

Non-compliance penalties are levied by the card brands and can include fines of $5,000 to $100,000 per month, increased transaction fees, and ultimately loss of the ability to process card payments.`,
  },
  {
    title: 'HIPAA Security Rule: Protecting Electronic Protected Health Information',
    category: 'compliance',
    tags: ['HIPAA', 'healthcare', 'PHI', 'ePHI', 'security rule'],
    content: `The Health Insurance Portability and Accountability Act (HIPAA) Security Rule establishes national standards for protecting electronic protected health information (ePHI) created, received, used, or maintained by covered entities and business associates. The Rule requires implementation of administrative, physical, and technical safeguards to ensure confidentiality, integrity, and availability of ePHI.

Covered entities include health plans, healthcare clearinghouses, and healthcare providers that conduct certain transactions electronically. Business associates — third parties that perform services on behalf of covered entities involving ePHI — are also directly liable under the Security Rule following the HITECH Act of 2009.

Administrative safeguards represent the majority of Security Rule requirements. These include conducting a thorough risk analysis to identify threats and vulnerabilities to ePHI, implementing a risk management plan to reduce identified risks to reasonable and appropriate levels, and maintaining a security awareness and training program for all workforce members. Organizations must also implement security incident procedures and a contingency plan for responding to emergencies.

Physical safeguards govern physical access to facilities and devices. Requirements include facility access controls, workstation use policies, workstation security, and device and media controls covering the disposal and reuse of electronic media. Organizations must document all physical access attempts and maintain logs.

Technical safeguards address the technology and policies protecting ePHI. Access control requirements include unique user identification, emergency access procedures, automatic logoff, and encryption and decryption capabilities. Audit controls require hardware, software, and procedural mechanisms to record and examine access and activity in systems containing ePHI. Transmission security requires measures to guard against unauthorized access during electronic transmission.

The Security Rule uses "required" and "addressable" implementation specifications. Required specifications must be implemented as written; addressable specifications allow flexibility to implement alternatives if the standard approach is not reasonable and appropriate, though the rationale must be documented. Many organizations incorrectly interpret "addressable" as optional — this is a common compliance mistake.`,
  },
  {
    title: 'FedRAMP: Cloud Security Authorization for Federal Agencies',
    category: 'frameworks',
    tags: ['FedRAMP', 'cloud', 'federal', 'ATO', 'authorization'],
    content: `The Federal Risk and Authorization Management Program (FedRAMP) is a US government-wide program that provides a standardized approach to security assessment, authorization, and continuous monitoring for cloud products and services. Established in 2011 by the Office of Management and Budget (OMB), FedRAMP enables federal agencies to leverage cloud services by providing a "do once, use many times" framework for security authorizations.

FedRAMP is based on NIST 800-53 controls and organized into three impact levels: Low, Moderate, and High. Most federal agencies operate at the Moderate level, which requires approximately 325 controls. High baseline systems — those containing particularly sensitive data — require over 400 controls. Low baseline applies to systems where compromise would have limited adverse effects.

Cloud Service Providers (CSPs) seeking FedRAMP authorization must engage a Third Party Assessment Organization (3PAO) accredited by FedRAMP to conduct an independent assessment. The authorization package includes a System Security Plan (SSP) documenting all controls, a Security Assessment Plan (SAP), a Security Assessment Report (SAR), and a Plan of Action and Milestones (POA&M) for any identified weaknesses.

There are two authorization pathways: Agency Authorization, where a specific federal agency sponsors the CSP and issues an Authority to Operate (ATO), and the FedRAMP Authorization process managed by the Joint Authorization Board (JAB) — a consortium of DoD, DHS, and GSA — which issues a Provisional ATO (P-ATO) recognized government-wide.

Continuous monitoring is a critical component of FedRAMP. Authorized CSPs must submit monthly vulnerability scanning results, annual security assessments, and near real-time monitoring data. Any significant changes to the system must be documented and may trigger a new assessment. FedRAMP authorization typically takes 12 to 18 months and represents a significant investment of $500,000 to $2 million for initial authorization.

The FedRAMP Marketplace lists all authorized and in-process cloud services, enabling agencies to quickly identify compliant solutions. Once authorized, CSPs can leverage their FedRAMP package to pursue business with multiple agencies without repeating the full authorization process.`,
  },
  {
    title: 'CIS Controls v8: Prioritized Cybersecurity Best Practices',
    category: 'frameworks',
    tags: ['CIS', 'controls', 'cybersecurity', 'best practices', 'prioritized'],
    content: `The Center for Internet Security (CIS) Controls v8 provides a prioritized set of actions to protect organizations against the most prevalent cyber threats. Released in May 2021, v8 consolidated the previous 20 controls into 18 controls and reorganized them around activities rather than the entities managing them. The controls are designed to help organizations of any size implement practical, cost-effective security measures.

CIS Controls are organized into three Implementation Groups (IGs) based on organizational maturity and resources. IG1 represents essential cyber hygiene applicable to all organizations with limited IT expertise and resources — 56 safeguards covering the most critical security practices. IG2 adds 74 safeguards for organizations with dedicated IT staff. IG3 includes all 153 safeguards for organizations with security experts addressing sensitive data or critical systems.

The 18 controls cover: Inventory and Control of Enterprise Assets, Inventory and Control of Software Assets, Data Protection, Secure Configuration of Enterprise Assets and Software, Account Management, Access Control Management, Continuous Vulnerability Management, Audit Log Management, Email and Web Browser Protections, Malware Defenses, Data Recovery, Network Infrastructure Management, Network Monitoring and Defense, Security Awareness and Skills Training, Service Provider Management, Application Software Security, Incident Response Management, and Penetration Testing.

The prioritization in CIS Controls is based on threat intelligence from actual attacks and reflects which defenses would have prevented or mitigated the most common attack scenarios. The controls were developed by a community of IT and security professionals from government, business, industry, and academia.

Mapping CIS Controls to other frameworks like NIST CSF, ISO 27001, and PCI DSS helps organizations demonstrate compliance across multiple standards simultaneously. Many organizations use CIS Controls as their primary security framework, especially those that are not subject to specific regulatory requirements but want to demonstrate a strong security posture.

Implementation resources include the CIS Benchmarks (hardening guides for operating systems, applications, and devices) and the CIS Controls Assessment Specification, which provides detailed procedures for evaluating safeguard implementation. The CIS Controls are freely available and represent one of the most practical starting points for cybersecurity programs.`,
  },
  {
    title: 'Zero Trust Architecture: Principles and Implementation Roadmap',
    category: 'security',
    tags: ['zero trust', 'ZTA', 'network security', 'identity', 'microsegmentation'],
    content: `Zero Trust Architecture (ZTA) is a security model based on the principle of "never trust, always verify" — eliminating implicit trust in any element inside or outside the traditional network perimeter. Formalized in NIST SP 800-207, ZTA assumes that threats exist both inside and outside traditional network boundaries and therefore every user, device, and network flow must be authenticated and authorized before access is granted.

The core tenets of Zero Trust include: all data sources and computing services are considered resources; all communication is secured regardless of network location; access to individual enterprise resources is granted on a per-session basis; access to resources is determined by dynamic policy; the enterprise ensures all owned and associated devices are in the most secure state possible; all resource authentication and authorization is dynamic and strictly enforced before access is allowed; and the enterprise collects as much information as possible about asset state, network traffic, and behavior to improve security posture.

Implementation of Zero Trust typically centers on five pillars: Identity, Device, Network, Application/Workload, and Data. Identity management forms the foundation — every user and service must have a strong, verified identity with Multi-Factor Authentication (MFA) enforced. Continuous validation checks whether identity, device health, and context justify access at the time of the request.

Device trust requires knowing which devices are accessing resources, their health status, and whether they meet minimum security requirements such as updated operating systems, enabled endpoint protection, and disk encryption. Mobile Device Management (MDM) or Unified Endpoint Management (UEM) solutions provide visibility and enforcement.

Microsegmentation divides the network into small zones with separate access for different parts of the network, limiting lateral movement if a breach occurs. Software-defined perimeters and next-generation firewalls enforce granular access policies based on application identity rather than IP addresses and ports.

Organizations typically implement Zero Trust incrementally across three stages: visualize (understand all assets, users, and data flows), mitigate (address risks and gaps in current architecture), and optimize (fully implement Zero Trust policies). CISA's Zero Trust Maturity Model provides a roadmap across five maturity levels from traditional to optimal.`,
  },
  {
    title: 'Multi-Factor Authentication Best Practices and Implementation Guide',
    category: 'security',
    tags: ['MFA', '2FA', 'authentication', 'identity', 'phishing-resistant'],
    content: `Multi-Factor Authentication (MFA) is one of the most effective security controls available, significantly reducing the risk of unauthorized account access even when passwords are compromised. MFA requires users to provide two or more verification factors from different categories: something you know (password), something you have (hardware token or phone), or something you are (biometrics).

Types of MFA range significantly in security strength. SMS and voice call OTPs are the weakest form — they are vulnerable to SIM swapping attacks and real-time phishing. Time-based One-Time Passwords (TOTP) via authenticator apps (Google Authenticator, Authy, Microsoft Authenticator) provide stronger protection. Push notifications through mobile apps add user presence confirmation. Hardware security keys (FIDO2/WebAuthn) using standards like YubiKey provide the strongest protection and are resistant to phishing attacks.

Phishing-resistant MFA is increasingly required by government regulations and frameworks. NIST 800-63-3 and OMB M-22-09 specifically require phishing-resistant authenticators for high-value accounts. FIDO2 and Smart Card/PIV credentials are the primary phishing-resistant options. These work by binding authentication to the specific website, making credential harvesting by phishing sites impossible.

Implementation best practices include: enforce MFA for all administrative accounts and remote access immediately; implement risk-based authentication that triggers step-up authentication for unusual access patterns; use conditional access policies to require MFA based on device compliance, location, and other risk signals; maintain backup MFA methods for account recovery; and monitor for MFA fatigue attacks where attackers spam push notifications hoping for an accidental approval.

Organizations should avoid MFA bypass configurations like "remember this device for 30 days" on sensitive applications and should log all authentication events including MFA success and failure. Regular review of which accounts have MFA enrolled and which bypass policies are in place helps ensure comprehensive coverage.

Employee education is critical for MFA adoption. Users should understand why MFA is required, how to use their chosen MFA method, and how to recognize and report MFA prompt bombing attacks where they receive unsolicited authentication requests.`,
  },
  {
    title: 'Incident Response Plan Template and Best Practices',
    category: 'operations',
    tags: ['incident response', 'IR plan', 'NIST', 'containment', 'forensics'],
    content: `An Incident Response (IR) Plan is a documented, structured methodology for handling security incidents including data breaches, malware infections, unauthorized access, and service disruptions. A well-crafted IR plan reduces response time, limits damage, preserves evidence, and helps organizations return to normal operations as quickly as possible.

The NIST Computer Security Incident Handling Guide (SP 800-61) defines four phases of incident response: Preparation, Detection and Analysis, Containment, Eradication and Recovery, and Post-Incident Activity. The Preparation phase involves establishing policies, creating response procedures, training the response team, and acquiring necessary tools. This is the most important phase as it determines how effectively the other phases can be executed.

Detection and Analysis involves identifying potential incidents through security monitoring tools, user reports, or automated alerts. Not every alert is an incident — the team must triage and determine whether an event represents an actual security incident and its severity. Clear criteria for escalation and severity classification help ensure consistent responses.

Containment strategies differ based on the type of incident. Short-term containment may involve isolating affected systems from the network. Long-term containment may involve applying patches or temporary fixes while maintaining system availability. Evidence preservation during containment is critical — teams should document system states and collect forensic images before taking remediation actions.

Eradication removes the root cause of the incident — eliminating malware, closing vulnerabilities, removing unauthorized accounts, or patching systems. Recovery involves restoring systems to normal operation, enhanced monitoring to detect recurrence, and validation that systems are clean. The timeline for returning systems to production should be carefully considered based on the nature of the incident.

Post-incident activities include a formal lessons learned meeting, updating the IR plan based on experience, and producing metrics about response effectiveness. Root cause analysis should drive improvements to prevent recurrence. Organizations should also fulfill notification obligations — breach notifications to regulators, customers, or law enforcement as required.`,
  },
  {
    title: 'Vendor Risk Management: Third-Party Assessment Framework',
    category: 'operations',
    tags: ['vendor risk', 'third-party', 'due diligence', 'supply chain', 'assessment'],
    content: `Vendor Risk Management (VRM) is the process of identifying, assessing, and mitigating risks associated with third-party vendors, suppliers, and service providers. As organizations increasingly rely on external parties for critical services, the risk surface extends well beyond the organization's direct control. Effective VRM programs ensure that vendors maintain security standards equivalent to or exceeding the organization's own requirements.

The VRM lifecycle begins with vendor inventory — cataloging all third parties that have access to organizational systems, data, or facilities. Many organizations discover they have far more vendors than anticipated when conducting their first inventory. Vendors should be classified by their risk profile based on the type of data they access, the criticality of services they provide, and the level of integration with internal systems.

Risk tiering assigns vendors to categories (typically Critical, High, Medium, Low) that determine the depth of due diligence required. Critical and High-risk vendors warrant comprehensive security questionnaires (such as those based on SIG, CAIQ, or custom frameworks), review of security certifications (SOC 2, ISO 27001), contract security requirements review, and potentially on-site assessments. Lower-risk vendors may require only a brief questionnaire and review of publicly available security documentation.

Security questionnaires typically cover data protection practices, access controls, encryption standards, incident response capabilities, business continuity and disaster recovery, vulnerability management, and sub-processor management. Standardized questionnaire formats like the SIG (Standardized Information Gathering) reduce the burden on vendors that respond to multiple customer assessments.

Contractual controls formalize security requirements. Vendor contracts should include data protection requirements aligned with applicable regulations, audit rights allowing the organization to verify compliance, breach notification obligations, requirements for security incident reporting, and termination rights for non-compliance.

Ongoing monitoring is as important as initial assessment. Annual reassessments, monitoring security ratings platforms (SecurityScorecard, BitSight), reviewing vendor security bulletins, and tracking regulatory actions against vendors all provide early warning of emerging vendor risks. Fourth-party risk — the vendors of your vendors — is increasingly recognized as a significant risk that must also be addressed.`,
  },
  {
    title: 'Business Continuity Planning: Ensuring Organizational Resilience',
    category: 'operations',
    tags: ['BCP', 'business continuity', 'disaster recovery', 'RTO', 'RPO'],
    content: `Business Continuity Planning (BCP) is the process of creating systems of prevention and recovery to deal with potential threats to a company. It ensures that personnel and assets are protected and can function quickly in the event of a disaster. Business Continuity Management (BCM) encompasses disaster recovery (DR), crisis management, and incident management.

The Business Impact Analysis (BIA) is the foundation of any BCP program. The BIA identifies critical business functions, determines the maximum tolerable downtime (MTD) for each function, and establishes Recovery Time Objectives (RTO — how quickly must the function be restored) and Recovery Point Objectives (RPO — how much data loss is acceptable). These objectives drive investment decisions for recovery capabilities.

Business continuity strategies must address several recovery scenarios: building or campus unavailability (fire, flooding, extended power outage), IT system unavailability (server failure, cyberattack, cloud provider outage), supplier or partner disruption, personnel unavailability (pandemic, civil unrest), and utility service disruption (telecommunications, electricity).

Recovery strategies range from cold sites (facilities with basic infrastructure requiring hours to days to activate), warm sites (partially equipped facilities requiring hours to activate), to hot sites (fully equipped and operational facilities enabling near-instant failover). Cloud-based recovery leverages infrastructure-as-code to provision replacement environments rapidly and cost-effectively.

Plan documentation should include crisis management structure and decision authorities, communication trees and templates for employees, customers, regulators, and media, detailed recovery procedures for critical systems and processes, contact lists for key personnel and vendors, and resource requirements for recovery operations.

Testing and exercising is critical for plan effectiveness. Tabletop exercises familiarize teams with their roles and identify plan gaps. Simulation exercises test specific aspects of the plan. Full interruption tests (rare) validate that recovery procedures work in practice. Plans should be reviewed and updated annually and after any significant organizational or technology change.`,
  },
  {
    title: 'Cloud Security Posture Management: Securing Multi-Cloud Environments',
    category: 'security',
    tags: ['cloud security', 'CSPM', 'AWS', 'Azure', 'GCP', 'misconfiguration'],
    content: `Cloud Security Posture Management (CSPM) refers to a set of practices and tools that continuously monitor cloud environments for misconfigurations, compliance violations, and security risks. As organizations migrate workloads to cloud providers like AWS, Azure, and Google Cloud, the shared responsibility model means organizations remain accountable for the security of their configurations, data, and applications even though the cloud provider secures the underlying infrastructure.

The most common cloud security failures stem from misconfigurations rather than sophisticated attacks. Publicly exposed S3 buckets, overly permissive IAM roles, unencrypted data stores, open security groups, disabled logging, and weak authentication settings have been responsible for numerous high-profile data breaches. CSPM tools continuously scan cloud environments to detect these misconfigurations before they can be exploited.

Identity and Access Management (IAM) is the most critical security control in cloud environments. Best practices include enforcing the principle of least privilege, requiring MFA for console access, using IAM roles instead of long-term access keys, rotating credentials regularly, and regularly reviewing and removing unused permissions through access reviews.

Network security in cloud environments focuses on security groups and network access control lists (NACLs) to restrict traffic, private subnets for backend systems, VPC peering and transit gateways for secure inter-account connectivity, and VPN or Direct Connect for hybrid connectivity. All management traffic should traverse private networks rather than the public internet.

Data protection in cloud environments requires encryption at rest using cloud provider key management services (AWS KMS, Azure Key Vault, GCP Cloud KMS) with customer-managed keys for sensitive data. Data in transit must be encrypted using TLS 1.2 or higher. Data classification determines which controls are applied — regulated data like PII and PHI requires more stringent controls than public data.

Cloud-native security services provide essential visibility: AWS GuardDuty, Azure Defender, and GCP Security Command Center detect threats through machine learning and threat intelligence. Cloud audit logs (CloudTrail, Activity Log, Cloud Audit Logs) provide the audit trail required for compliance and forensic investigation. Organizations should centralize logs in a SIEM for correlation and alerting.`,
  },
  {
    title: 'Data Classification Policy: Framework for Protecting Sensitive Information',
    category: 'controls',
    tags: ['data classification', 'data governance', 'sensitivity', 'labeling', 'DLP'],
    content: `A Data Classification Policy establishes a framework for categorizing organizational data based on its sensitivity, value, and criticality to the organization. Proper classification ensures that appropriate security controls are applied proportionally — protecting sensitive data more stringently while avoiding unnecessary overhead for less sensitive information.

Most organizations use a three or four-tier classification scheme. A common framework includes: Public (information that can be freely shared with no restrictions), Internal (information for internal use that is not intended for public disclosure), Confidential (sensitive business information with restricted access), and Restricted or Highly Confidential (most sensitive data requiring the highest level of protection, such as regulated data, trade secrets, or critical system credentials).

Classification criteria typically consider: regulatory requirements (data subject to GDPR, HIPAA, PCI DSS, or other regulations is automatically at higher classification levels), business impact if disclosed (financial loss, competitive harm, reputational damage), legal obligations (attorney-client privilege, export controls), and contractual obligations to customers or partners.

Data owners — typically senior business stakeholders responsible for data-generating processes — are responsible for classifying data under their purview and reviewing classifications annually. Data custodians (typically IT) implement and maintain the technical controls appropriate for each classification level. All employees are responsible for handling data according to its classification.

Classification labels are applied through multiple mechanisms: manually by users in documents and emails, automatically by Data Loss Prevention (DLP) systems that inspect content, or through integration with data discovery tools that scan repositories to identify sensitive data. Microsoft Purview, Varonis, and similar tools provide automated classification capabilities.

Control requirements by classification level typically address: access controls (who can access), encryption (at rest and in transit), sharing restrictions (internal only vs. need-to-know), transmission requirements (encrypted email, secure file transfer), storage locations (approved cloud services vs. local storage), and retention and disposal procedures. Regular data hygiene practices — identifying and deleting data no longer needed for business purposes — reduce risk and compliance scope.`,
  },
  {
    title: 'Access Control Models: RBAC, ABAC, and Zero Trust Implementation',
    category: 'controls',
    tags: ['access control', 'RBAC', 'ABAC', 'least privilege', 'PAM'],
    content: `Access control is the selective restriction of access to resources in a computing environment. Implementing appropriate access control models ensures that users, systems, and applications can only access the resources they need to perform their authorized functions. Several models exist, each with different strengths suited to different environments and use cases.

Role-Based Access Control (RBAC) assigns permissions to roles rather than to individual users. Users are then assigned to roles appropriate for their job function. RBAC is the most widely implemented model due to its simplicity and administrative efficiency. A user account manager role, for example, might have permission to create and modify user accounts but not access financial systems. RBAC scales well in environments with clear job function boundaries and hierarchical organizational structures.

Attribute-Based Access Control (ABAC) grants access based on attributes of the user (department, clearance level, location), resource (classification, owner, age), and environment (time of day, network location, threat level). ABAC enables much more granular and dynamic access decisions than RBAC but requires more sophisticated infrastructure and is more complex to manage. Cloud IAM systems like AWS IAM support ABAC through tag-based policies.

Mandatory Access Control (MAC) enforces access based on security labels assigned by a central authority rather than the resource owner. MAC is used primarily in high-security government environments where strict information compartmentalization is required. Discretionary Access Control (DAC) allows resource owners to control access to their resources, which is common in file systems but can lead to permission sprawl if not governed carefully.

Privileged Access Management (PAM) specifically addresses high-risk administrative accounts that have elevated permissions to critical systems. PAM solutions provide just-in-time (JIT) access — granting elevated privileges only when needed and for a defined time period — along with session recording, privileged credential vaulting, and detailed audit logging of all privileged activities.

The principle of least privilege requires that users, processes, and systems have only the minimum access required to perform their function. Implementing least privilege requires regular access reviews to identify and remove unnecessary permissions (access recertification), automated provisioning and de-provisioning tied to HR systems, and separation of duties to prevent any single person from having excessive control over critical processes.`,
  },
  {
    title: 'Encryption Standards and Key Management Best Practices',
    category: 'controls',
    tags: ['encryption', 'AES', 'TLS', 'key management', 'PKI', 'cryptography'],
    content: `Encryption is the process of converting readable data (plaintext) into an unreadable format (ciphertext) using cryptographic algorithms. Proper encryption protects data confidentiality both in transit (as it moves between systems) and at rest (while stored). Selecting appropriate encryption algorithms and managing cryptographic keys correctly are essential for effective data protection.

For symmetric encryption (encrypting and decrypting with the same key), AES-256 (Advanced Encryption Standard with 256-bit keys) is the current standard and is approved for protecting classified US government information up to TOP SECRET level. AES-128 provides acceptable security for most commercial use cases with better performance. Older algorithms like DES and 3DES should be avoided as they are considered cryptographically weak.

For data in transit, TLS (Transport Layer Security) 1.2 is the minimum acceptable version — TLS 1.3 is preferred for new implementations due to improved security and performance. SSL and TLS 1.0/1.1 are deprecated and vulnerable to known attacks. Certificate pinning provides additional protection against man-in-the-middle attacks for mobile applications. HSTS (HTTP Strict Transport Security) should be enabled to prevent protocol downgrade attacks.

Asymmetric (public key) cryptography uses key pairs for digital signatures and key exchange. RSA with 2048-bit keys is acceptable but 4096-bit is recommended for long-term protection. Elliptic Curve Cryptography (ECC) provides equivalent security with shorter key lengths — ECDSA and ECDH are preferred for performance-sensitive applications. Post-quantum cryptography standards are being finalized by NIST to address the future threat of quantum computers.

Key management is as critical as the encryption algorithm itself — compromised keys render encryption useless. Key management practices include: generating keys using cryptographically secure random number generators, protecting key material with hardware security modules (HSMs) for the most sensitive keys, implementing key rotation procedures to limit exposure from compromised keys, separating key management duties from system administration, and securely backing up key material while restricting access to backups.

Cryptographic inventories — documentation of all encryption implementations, algorithm choices, key lengths, and certificate expiration dates — are essential for managing cryptographic risk, planning algorithm migrations, and responding to vulnerabilities in specific implementations.`,
  },
  {
    title: 'Security Awareness Training: Building a Human Firewall',
    category: 'security',
    tags: ['security awareness', 'phishing', 'training', 'social engineering', 'culture'],
    content: `Security awareness training is the process of providing employees with knowledge and skills to identify and respond appropriately to security threats. Despite technological controls, humans remain both the most targeted attack vector and the last line of defense against many threats. A comprehensive security awareness program transforms employees from security risks into active participants in the organization's security program.

Phishing simulations are the cornerstone of practical security awareness programs. Regular simulated phishing exercises test employee ability to recognize and report suspicious emails. Modern phishing simulations use templates mimicking real-world attack techniques — credential harvesting pages, malicious attachments, OAuth consent phishing — and measure click rates, credential submission rates, and reporting rates. Organizations that run phishing simulations consistently see significant improvement in employee vigilance over time.

Training content must be engaging to be effective. Traditional annual compliance training is insufficient — it is quickly forgotten and fails to build lasting behavior change. Effective programs include: short (3-5 minute) training modules triggered by failed phishing simulations, regular security newsletters highlighting current threats, real-world stories that illustrate consequences, and gamification elements like quizzes and leaderboards. Training should be relevant to employees' specific roles and the threats they are most likely to encounter.

Core topics for security awareness training include: phishing and social engineering recognition, password security and password manager usage, MFA importance and how to use it, safe web browsing and email practices, remote work security (home Wi-Fi security, VPN usage), physical security (tailgating prevention, clean desk policy), data handling and classification, incident reporting procedures, and mobile device security.

Metrics for measuring program effectiveness include phishing simulation click rates and reporting rates over time, security incident reports from employees, helpdesk tickets for security-related issues, and training completion rates. A successful program demonstrates a downward trend in phishing click rates and an upward trend in suspicious email reporting.

Leadership involvement significantly impacts program effectiveness. When executives participate visibly in training and communicate the importance of security, employees take the program more seriously. Consider appointing Security Champions in each department — employees with a particular interest in security who serve as local resources and advocates.`,
  },
  {
    title: 'Audit Log Management: Requirements, Retention, and Analysis',
    category: 'operations',
    tags: ['audit logs', 'SIEM', 'log management', 'monitoring', 'compliance'],
    content: `Audit log management is the process of collecting, storing, protecting, and analyzing logs from systems, applications, and network devices to support security monitoring, incident investigation, and regulatory compliance. Comprehensive logging provides the evidence trail necessary to detect attacks, investigate incidents, demonstrate compliance, and support legal proceedings.

What to log: Authentication events (login success/failure, MFA, privilege escalation), authorization decisions (access granted/denied), data access and modification (especially for sensitive data), configuration changes (to systems, security controls, and network devices), administrative actions (user creation/deletion, permission changes), and application errors that may indicate attack attempts or misuse. NIST 800-92 provides detailed guidance on log content requirements.

Centralized log management is essential for effective security operations. A Security Information and Event Management (SIEM) system aggregates logs from diverse sources, normalizes them into a common format, correlates events across sources to detect attack patterns, and provides alerting and reporting capabilities. Leading SIEM platforms include Splunk, Microsoft Sentinel, IBM QRadar, and Elastic Security.

Log retention requirements vary by regulation and use case. PCI DSS requires 12 months of log history (3 months immediately available). HIPAA requires 6 years. SOX requires 7 years. General security best practice recommends 90 days hot (immediately searchable) and 12 months archived. Logs should be stored in a write-once, read-many format (WORM) to prevent tampering.

Log protection is critical — if an attacker can modify or delete logs, they can cover their tracks. Logs should be forwarded to a centralized server immediately after generation (rather than stored only on the originating system), protected with integrity controls such as hash chaining, access-controlled so only authorized personnel can read and manage logs, and backed up regularly.

Alert tuning is an ongoing challenge. Raw logs generate enormous volumes of events, and poorly tuned alerts lead to alert fatigue where security teams ignore notifications. Effective alert management requires identifying the highest-priority detection scenarios, writing precise detection rules, establishing thresholds based on baseline behavior, and regularly reviewing and refining rules based on false positive rates and investigation outcomes.`,
  },
  {
    title: 'Vulnerability Management Program: From Discovery to Remediation',
    category: 'operations',
    tags: ['vulnerability management', 'scanning', 'patching', 'CVE', 'CVSS', 'remediation'],
    content: `Vulnerability management is the systematic practice of identifying, evaluating, remediating, and reporting on security vulnerabilities in systems and software. A mature vulnerability management program provides continuous visibility into the organization's attack surface and ensures that weaknesses are addressed before they can be exploited by attackers.

Vulnerability scanning forms the foundation of any program. Authenticated network scans (scanners with credentials to access target systems) provide far more complete results than unauthenticated scans and should be used for internal systems. Common scanning tools include Tenable Nessus, Qualys, Rapid7 InsightVM, and the open-source OpenVAS. Scans should cover all in-scope assets including servers, workstations, network devices, databases, web applications, and cloud resources.

The Common Vulnerability Scoring System (CVSS) provides a standardized score from 0.0 to 10.0 for each vulnerability based on factors including attack vector, attack complexity, privileges required, user interaction, and potential impact. CVSS scores categorize vulnerabilities as Critical (9.0-10.0), High (7.0-8.9), Medium (4.0-6.9), or Low (0.1-3.9). Organizations should supplement CVSS scores with context including whether the vulnerability is exploitable in their specific environment and whether exploit code is publicly available.

Remediation prioritization using risk-based approaches considers CVSS score alongside asset criticality, exposure (internet-facing vs. internal), and threat intelligence (whether the vulnerability is being actively exploited in the wild). CISA's Known Exploited Vulnerabilities (KEV) catalog identifies vulnerabilities with confirmed active exploitation — these warrant immediate remediation regardless of CVSS score.

SLAs for remediation should be defined based on severity. Common targets include: Critical — 24 to 72 hours for internet-facing systems, 7 days for internal; High — 7 to 14 days; Medium — 30 to 60 days; Low — 90 to 180 days. Exceptions to SLAs require documented risk acceptance with business justification and compensating controls.

Web application vulnerabilities require specialized scanning using dynamic application security testing (DAST) tools and manual penetration testing. The OWASP Top 10 identifies the most critical web application security risks including injection, broken authentication, cross-site scripting (XSS), and broken access control. Static application security testing (SAST) integrated into CI/CD pipelines catches vulnerabilities during development before deployment to production.`,
  },
]

async function seed() {
  console.log('Seeding knowledge base entries...')

  for (const article of ARTICLES) {
    await db.insert(knowledgeBaseEntries).values({
      title: article.title,
      content: article.content,
      category: article.category,
      tags: article.tags,
      embedding: null,
      isPublic: true,
      isBuiltIn: true,
      metadata: { sourceType: 'internal' },
    })
    console.log(`  ✓ ${article.title.slice(0, 60)}...`)
  }

  console.log(`\nSeeded ${ARTICLES.length} knowledge base articles.`)
}

seed().catch(console.error)
