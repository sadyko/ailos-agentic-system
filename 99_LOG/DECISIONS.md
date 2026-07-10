2026-06-30  STEP_01  PASS  150f36d524af6eb14bb2182710ebd8813b8ff33f
2026-06-30  STEP_01  PASS  0496c0e9b0f206c6820ff18b713d56a17144ce0c
2026-06-30  ui  STEP_01  PASS  47a3bee2833928ce2cfd39039e2a8f05c6405d29

## 2026-07-10 — EasyMed small-clinic features: Phases 1–4 deployed live (Phase 0 DDL staged)
- All SPA + gateway code for custom services, daily stationary billing, drug orders and Rx handoff is live on 45.77.242.169 (details: docs/superpowers/plans/2026-07-04-easymed-clinic-features.md → EXECUTION STATUS).
- Every new path is forward-compatible: with the DDL not yet run, the gateway flags endpoint returns all-false defaults and the SPA behaves exactly as before (verified live). Migration staged at /var/www/easymed.uz/supabase/migrations/102_clinic_features.sql; on-server + appointment-mvp Supabase PATs are revoked (401) so the owner runs the SQL (dashboard or apply_102 runner with a fresh token).
- Plan deviation (Phase 3): EasyMed already had atomic SECURITY-DEFINER dispense RPCs (dispense_visit_item / dispense_admission_item / void_dispensed_*) wired to «Выдать препарат» in the workspace and admission modal. Kept them as the billing/stock engine; added the missing spec pieces only — med_administrations journal mirror on stationary dispense (GIVE_DRUG_LOG_V1) and a per-Rx «Выдать» handoff button (RX_DISPENSE_V1, item picker prefiltered by Rx name). The new gateway POST /api/v1/inpatient/administer-drug was still deployed and fully data-tested (log+bill+stock, rollback, negative-stock guard) as the unified API path.
- Cache-busting unified: 13 modules retagged ?v=clinic1 across the import graph (fixed the pre-existing vm14/vm15 double-instance of visit-modal).
