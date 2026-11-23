# Backend Requirements Quality Checklist: Xác thực Người dùng, Động cơ Học tập Tương tác, Ôn tập Ngắt quãng SM-2 và Chuỗi Ngày học (Streak)

**Purpose**: Rà soát tính đầy đủ, rõ ràng, nhất quán và khả năng đo lường của các yêu cầu backend trong feature `002-backend-core`.
**Created**: 2026-11-23
**Feature**: [spec.md](../spec.md)

**Note**: Checklist tùy chỉnh này được tạo từ nội dung feature và các yêu cầu hiện có.
**Review Ownership**: Đây là tài liệu rà soát chất lượng yêu cầu do reviewer sở hữu. Chỉ đánh dấu `[x]` khi reviewer xác nhận tiêu chí chất lượng yêu cầu đã đạt.
**Marker Semantics**: `[x]` nghĩa là tiêu chí đã được xem xét và đạt về chất lượng yêu cầu; không có nghĩa là phần triển khai đã hoàn tất.

## Requirement Completeness

- [x] CHK001 Are the administrative actions and the boundary between learner and administrator permissions explicitly enumerated? [Gap, Spec §FR-001]
- [x] CHK002 Are the requirements for account deactivation, deletion, and the effect on associated learning records defined or explicitly excluded? [Gap, Spec §Scope & System Boundary; §FR-001]
- [x] CHK003 Are all profile fields that learners may view or change, including validation and privacy expectations, specified? [Completeness, Spec §User Story 1; §Key Entities]
- [x] CHK004 Are requirements for account recovery and forgotten passwords explicitly defined as in-scope or out-of-scope? [Assumption, Spec §Assumptions; §FR-002]
- [x] CHK005 Are required error outcomes defined for Google sign-in failures, including rejected unverified email and provider unavailability? [Coverage, Spec §FR-002; §US1-AS4; §US1-AS12]
- [x] CHK006 Are rules for quiz expiration, abandoned attempts, and resubmission after partial submission specified? [Gap, Spec §FR-006; §FR-009; §Key Entities]
- [x] CHK007 Are empty or insufficient vocabulary-pool requirements defined for each distractor fallback tier and mixed quiz sampling? [Coverage, Spec §FR-006; §Edge Cases]
- [x] CHK008 Are audit-log access, retention, and handling of personal identifiers defined? [Gap, Spec §FR-014; §Key Entities]

## Requirement Clarity and Consistency

- [x] CHK009 Are configurable failed-login thresholds and cooldown behavior bounded sufficiently for acceptance without choosing implementation-specific values? [Clarity, Spec §FR-002; §US1-AS11]
- [x] CHK010 Are account identity and Google-account linking rules consistent for verified email, duplicate email, and an already-linked Google identity? [Consistency, Spec §FR-002; §US1-AS2; §US1-AS4; §US1-AS12]
- [x] CHK011 Are the meaning of “lesson completed,” the score denominator, and rounding rules consistent across lesson practice, retakes, and unlock decisions? [Consistency, Spec §FR-005; §FR-008; §US2]
- [x] CHK012 Are the terms and boundaries for an SM-2 review “session,” due words, and streak qualification consistent across requirements and scenarios? [Clarity, Spec §FR-009; §FR-011; §FR-012]
- [x] CHK013 Are timeout, blank-answer, and client-supplied response-time rules consistent with the accepted `q = 0` behavior? [Consistency, Spec §FR-008; §FR-009; §Edge Cases]
- [x] CHK014 Are session revocation expectations after logout, refresh-token reuse, and password change distinct and consistent across the user story, requirements, and scenarios? [Consistency, Spec §FR-003; §US1-AS6–US1-AS10]
- [x] CHK015 Are day-boundary and timezone rules stated consistently for streaks, due reviews, and reminder scheduling, including daylight-saving behavior if relevant? [Clarity, Spec §FR-009; §FR-011–FR-013; §Assumptions]

## Scenario and Edge-Case Coverage

- [x] CHK016 Are negative and recovery requirements defined for database, Redis, and queue failures that affect authentication, SM-2 updates, or reminder delivery? [Gap, Spec §FR-003; §FR-009; §FR-013; §Edge Cases]
- [x] CHK017 Are duplicate or concurrent quiz submissions and their effects on scores, lesson completion, and SM-2 updates specified? [Coverage, Spec §FR-009; §US2; §US4]
- [x] CHK018 Are reminder retry exhaustion, duplicate scheduling, and recovery after a worker outage defined without violating the one-email-per-user-per-day rule? [Coverage, Spec §FR-013; §US5-AS4–US5-AS5; §Edge Cases]
- [x] CHK019 Are requirements defined for learners with no due review words, no completed lessons, or no activity history in statistics and streak views? [Gap, Spec §User Story 5; §FR-011–FR-012]
- [x] CHK020 Are requirements for a lesson whose vocabulary count is outside the inherited 15–18 range, including the final-lesson exception, clearly assigned to the correct feature boundary? [Consistency, Spec §Scope & System Boundary; §User Story 2; §Assumptions]

## Acceptance Criteria and Non-Functional Quality

- [x] CHK021 Can each security and authorization requirement be traced to measurable acceptance scenarios, including learner isolation and administrator access? [Traceability, Spec §FR-001; §US1-AS5]
- [x] CHK022 Are performance targets tied to defined measurement conditions, percentile, workload, and operation boundaries consistently across the spec and plan? [Measurability, Spec §SC-006–SC-007; Plan §Performance Goals]
- [x] CHK023 Are reliability, availability, backup, and recovery expectations for persistent learning and review data stated or explicitly deferred? [Gap, Spec §Success Criteria; §Assumptions]
- [x] CHK024 Are privacy and data-protection requirements for email, IP address, device metadata, and audit records sufficiently specified? [Coverage, Spec §Key Entities; §FR-014]
- [x] CHK025 Do the API contract's documented success and failure outcomes cover the functional scenarios and use the response envelope required by the project constitution? [Consistency, Spec §FR-002–FR-014; Contract §components/responses]
- [x] CHK026 Are all Given/When/Then scenarios uniquely identified and traceable to functional requirements, including the recently added login and session cases? [Traceability, Spec §User Scenarios & Testing]

## API and Security Boundary Coverage

- [x] CHK027 Are authentication and authorization expectations stated for every protected API operation, including administrator-only operations? [Coverage, Spec §FR-001; Contract]
- [x] CHK028 Are API error response fields and status outcomes specified consistently for validation failures, unauthorized requests, forbidden requests, conflicts, and rate limits? [Clarity, Contract §components/responses; Constitution §IV]
- [x] CHK029 Are request validation limits in the API contract consistent with the corresponding functional requirements for all user-provided fields? [Consistency, Spec §FR-002; Contract]
- [x] CHK030 Are requirements for safe Google OAuth request/response validation and protection against forged or replayed sign-in responses documented? [Gap, Spec §FR-002; Contract]
- [x] CHK031 Are rules for handling sensitive fields in API responses, including password hashes, refresh-token values, and audit metadata, explicitly stated? [Completeness, Spec §FR-003; §FR-014; Contract]
- [x] CHK032 Are authorization and ownership requirements clear for retrieving or changing quiz attempts, study progress, review cards, and statistics by identifier? [Coverage, Spec §FR-001; §Key Entities; Contract]
- [x] CHK033 Are requirements for duplicate submissions explicit about whether the API returns the original result or rejects the repeated request? [Ambiguity, Spec §FR-009; §Key Entities; Contract]
- [x] CHK034 Are external-provider failure requirements defined for Google sign-in and email delivery without exposing secrets or internal diagnostics to users? [Coverage, Spec §FR-002; §FR-013–FR-014; §Edge Cases]
- [x] CHK035 Are API pagination, maximum response sizes, and query limits specified for learner lists and administrator-facing collections where applicable? [Gap, Spec §FR-001; §FR-011; Contract]
- [x] CHK036 Are requirements clear on which user and operational actions must be auditable, including administrator changes and account lifecycle events? [Completeness, Spec §FR-014; §Key Entities]

## Learning, Scoring, and Spaced-Repetition Requirements

- [x] CHK037 Are acquisition completion and its effect on first attempts and retakes stated consistently for every lesson? [Consistency, Spec §FR-004; §US2]
- [x] CHK038 Are completion status, best score, and next-lesson unlocking rules clearly distinguished when later attempts score below the passing threshold? [Clarity, Spec §FR-005; §US2-AS4–US2-AS5]
- [x] CHK039 Are score calculation, percentage rounding, and pass-threshold comparisons specified without boundary ambiguity? [Measurability, Spec §FR-005; §FR-008; §US2-AS4–US2-AS5]
- [x] CHK040 Are exact-match, near-match, phonetic-match, incorrect, blank, and timeout outcomes mutually exclusive and consistently mapped to points? [Consistency, Spec §FR-007–FR-008; §US3]
- [x] CHK041 Are the minimum word length and edit-distance rules for “near match” unambiguous for insertion, deletion, substitution, and adjacent transposition? [Clarity, Spec §FR-007; §US3-AS3; §US3-AS5]
- [x] CHK042 Are the phonetic-match criteria and learner-facing outcome sufficiently defined for dictation answers that are not exact or near matches? [Completeness, Spec §FR-007; §US3-AS4]
- [x] CHK043 Are the response-time boundary values at 5,000 ms and 12,000 ms assigned consistently to exactly one SM-2 quality rating? [Boundary, Spec §FR-008; §US4-AS1–US4-AS3]
- [x] CHK044 Is it clear whether every submitted question, including skipped or timed-out questions, updates SM-2 exactly once regardless of lesson pass status? [Consistency, Spec §FR-008–FR-009; §US2-AS4; §Edge Cases]
- [x] CHK045 Are SM-2 update order, ease-factor floor, precision, and rounding rules complete for both successful and failed recall? [Clarity, Spec §FR-009; §US4-AS1–US4-AS5]
- [x] CHK046 Are the interval rules for the first, second, and subsequent successful repetitions explicit about rounding and the date used to compute the next due date? [Measurability, Spec §FR-009; §US4-AS1–US4-AS3]
- [x] CHK047 Are the SM-2 repetition count and Leitner box mapping defined consistently after every quality rating, including a reset after failure? [Consistency, Spec §FR-009–FR-010; §US4-AS4–US4-AS5]
- [x] CHK048 Are due-review ordering, page/session limit, and total-due count clearly defined when fewer words are due than the requested limit or none are due? [Clarity, Spec §FR-011; §US4-AS6]
- [x] CHK049 Is the streak qualification rule clear about whether the qualifying review-word count is measured at session start or at submission time? [Ambiguity, Spec §FR-012; §Key Entities]
- [x] CHK050 Are same-day repeated study activities and concurrent streak updates specified so that a learner's daily progress is counted once without losing valid progress? [Coverage, Spec §FR-012; §US5]

## Operations, Performance, and Recovery Requirements

- [x] CHK051 Are the hardware, database state, concurrency level, sample size, and measured operations for the `p95 < 200 ms` target defined consistently in the spec and plan? [Measurability, Spec §SC-006; Plan §Performance Goals]
- [x] CHK052 Is the 10,000-learner reminder scan target clear about whether it measures query/eligibility selection, queue enqueueing, or successful email delivery? [Clarity, Spec §SC-007; §FR-013; Plan §Performance Goals]
- [x] CHK053 Are acceptable API behavior and user-visible outcomes specified when PostgreSQL is unavailable during a state-changing learning or review request? [Gap, Spec §FR-004–FR-012; §Success Criteria]
- [x] CHK054 Are recovery expectations specified for Redis/queue outages affecting refresh-token revocation, rate limiting, and reminder scheduling? [Coverage, Spec §FR-002–FR-003; §FR-013]
- [x] CHK055 Is the fail-closed requirement for security-sensitive Redis operations consistent with the expected behavior of unrelated learning operations during the same outage? [Consistency, Spec §FR-013; §FR-003–FR-012]
- [x] CHK056 Are retry exhaustion, persistent queue failure, and eventual recovery behavior defined for reminder jobs after the allowed retry count is reached? [Gap, Spec §FR-013; §Edge Cases]
- [x] CHK057 Are duplicate reminder prevention and recovery after a crash between queueing and recording the sent/claimed state defined without risking either duplicate email or silent loss? [Coverage, Spec §FR-013; §US5-AS5; §Key Entities]
- [x] CHK058 Are scheduler behavior and recovery defined when the 20:00 job is delayed, missed, or restarted across a deployment or host outage? [Gap, Spec §FR-013; §SC-007]
- [x] CHK059 Are data durability, backup frequency, retention, and restoration expectations defined for account, progress, quiz, and SM-2 records? [Gap, Spec §Key Entities; §Success Criteria]
- [x] CHK060 Are service availability or maintenance expectations stated, or explicitly deferred for this feature's backend dependencies? [Gap, Spec §Success Criteria; Plan §Target Platform]
- [x] CHK061 Are the required operational signals and alert thresholds specified for failed login spikes, queue backlog, email delivery failures, and delayed reminder scans? [Gap, Spec §FR-002; §FR-013–FR-014; Plan §Performance Goals]
- [x] CHK062 Are user-facing failure messages and retry guidance defined for temporary database, Redis, Google, and SMTP outages without exposing internal diagnostics? [Coverage, Spec §FR-013; §Edge Cases]

## Data Integrity and Schema Requirements

- [x] CHK063 Are the foreign-key ownership rules for answer rows clear enough to prevent an answer from referencing a quiz attempt owned by a different learner? [Integrity, Data Model §2.4–§2.5]
- [x] CHK064 Are the allowed values and state transitions for quiz attempts and answers aligned across the functional requirements, entity definitions, and database constraints? [Consistency, Spec §FR-006–FR-009; Data Model §2.4–§2.5; §3]
- [x] CHK065 Are integrity rules defined for `opened_vocabulary_ids` so that only vocabulary items belonging to the associated lesson can count toward acquisition completion? [Completeness, Spec §FR-004; Data Model §2.3]
- [x] CHK066 Are invariants between quiz attempt totals, answer records, score percentage, and submission timestamps explicitly specified? [Gap, Spec §FR-008–FR-009; Data Model §2.4–§2.5]
- [x] CHK067 Are the conditions for a valid refresh-session token chain, including replacement links and revocation timestamps, stated as data invariants? [Clarity, Spec §FR-003; Data Model §2.2]
- [x] CHK068 Are uniqueness and concurrency requirements for `(user_id, vocabulary_id)` SM-2 records consistent with exactly-once sequential updates? [Consistency, Spec §FR-009; Data Model §2.6]
- [x] CHK069 Are all numeric ranges and cross-field invariants for SM-2 values, Leitner boxes, streak counters, and answer quality ratings defined consistently in requirements and schema? [Integrity, Spec §FR-008–FR-012; Data Model §2.5–§2.8]
- [x] CHK070 Are daily-log counter definitions and their relationship to streak qualification explicit, including which events increment each counter? [Clarity, Spec §FR-012; Data Model §2.8]
- [x] CHK071 Are reminder state fields sufficiently defined to distinguish queued, delivered, failed, and retried notifications while preserving the once-per-day rule? [Completeness, Spec §FR-013; Data Model §2.8]
- [x] CHK072 Are deletion and retention rules consistent across user-owned learning data, refresh sessions, and audit records? [Consistency, Spec §FR-014; Data Model §2.2–§2.9]
- [x] CHK073 Are dependencies on Feature `001-vocabulary-data` explicit enough to keep foreign keys and topic/level relationships valid through schema upgrades? [Dependency, Spec §Scope & System Boundary; Data Model §1; §4]
- [x] CHK074 Are migration rollback and partial-failure requirements defined for schema changes that create or alter related tables and constraints? [Recovery, Data Model §4; Plan §Project Structure]

## Notes

- Mark items `[x]` only after review confirms the requirement-quality criterion is satisfied.
- Leave items unchecked when they still need clarification, correction, or reviewer evaluation.
- `$speckit-implement` reads checklist checkbox state as a gate and must not modify markers.
- `checklists/requirements.md` is a separate built-in spec-quality checklist maintained by `$speckit-specify` and `$speckit-clarify`.
- This checklist evaluates the quality of written requirements, not whether the implementation works.
