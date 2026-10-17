CREATE TYPE "public"."access_tier" AS ENUM('standard', 'elevated', 'restricted');--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('active', 'pending_invite', 'pending_verification', 'suspended', 'dormant');--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('individual', 'company');--> statement-breakpoint
CREATE TYPE "public"."advisory_patch_status" AS ENUM('unpatched', 'patch_in_progress', 'patched');--> statement-breakpoint
CREATE TYPE "public"."advisory_status" AS ENUM('draft', 'published', 'retracted');--> statement-breakpoint
CREATE TYPE "public"."audit_category" AS ENUM('authentication', 'scan_completion', 'report_release', 'administrative', 'security_event', 'system');--> statement-breakpoint
CREATE TYPE "public"."audit_severity" AS ENUM('ok', 'info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."billing_cycle" AS ENUM('monthly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."blog_category" AS ENUM('news', 'threat_intel', 'blog', 'industry_updates', 'tutorials');--> statement-breakpoint
CREATE TYPE "public"."broadcast_kind" AS ENUM('initial', 'rebroadcast', 'retraction');--> statement-breakpoint
CREATE TYPE "public"."broadcast_status" AS ENUM('queued', 'sending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."career_role" AS ENUM('student', 'business_owner', 'cybersecurity_professional', 'independent_specialist');--> statement-breakpoint
CREATE TYPE "public"."contact_category" AS ENUM('penetration_testing_request', 'vulnerability_report', 'journalist_blogger_profile_request', 'whistleblower_tip', 'general_support');--> statement-breakpoint
CREATE TYPE "public"."contact_status" AS ENUM('new', 'triaged', 'closed');--> statement-breakpoint
CREATE TYPE "public"."content_review_action" AS ENUM('approve', 'request_changes', 'reject', 'publish', 'schedule', 'remind_author');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'pending_review', 'in_review', 'changes_requested', 'approved', 'rejected', 'scheduled', 'published');--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('blog_post', 'news_announcement', 'threat_advisory', 'product_listing');--> statement-breakpoint
CREATE TYPE "public"."display_currency" AS ENUM('USD', 'KES', 'NGN', 'GHS', 'ZAR');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('individual', 'company', 'corporation');--> statement-breakpoint
CREATE TYPE "public"."finding_severity" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."finding_status" AS ENUM('open', 'validated', 'false_positive', 'remediated');--> statement-breakpoint
CREATE TYPE "public"."industry" AS ENUM('financial_services_fintech', 'sacco_microfinance', 'banking', 'insurance', 'healthcare', 'telecommunications', 'government_public_sector', 'education', 'retail_ecommerce', 'technology_saas', 'other');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('draft', 'pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'pending', 'paid', 'overdue', 'void');--> statement-breakpoint
CREATE TYPE "public"."journal_kind" AS ENUM('invoice_issued', 'payment_captured', 'refund', 'adjustment', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."ledger_account_type" AS ENUM('asset', 'liability', 'revenue', 'expense', 'equity');--> statement-breakpoint
CREATE TYPE "public"."ledger_direction" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."mfa_method" AS ENUM('totp', 'webauthn', 'email_otp');--> statement-breakpoint
CREATE TYPE "public"."node_status" AS ENUM('operational', 'high_load', 'drift_warning', 'degraded', 'offline');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'email', 'sms', 'push');--> statement-breakpoint
CREATE TYPE "public"."notification_event" AS ENUM('signin_new_device', 'credentials_changed', 'failed_auth', 'scan_completed', 'job_awaiting_review', 'critical_finding', 'advisory_broadcast', 'threat_level_change', 'content_awaiting_moderation', 'team_member_provisioned', 'weekly_digest');--> statement-breakpoint
CREATE TYPE "public"."payment_attempt_status" AS ENUM('created', 'requires_action', 'succeeded', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."payment_channel" AS ENUM('card', 'mpesa', 'bank_transfer');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('stripe', 'paystack');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('paid', 'pending', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."pentest_status" AS ENUM('received', 'scoping', 'scheduled', 'converted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."pentest_target_type" AS ENUM('web_application', 'network_infrastructure', 'api', 'mobile_app');--> statement-breakpoint
CREATE TYPE "public"."recovery_question" AS ENUM('first_pet', 'birth_city', 'maiden_name', 'first_car', 'first_school');--> statement-breakpoint
CREATE TYPE "public"."review_check_key" AS ENUM('scope_authorisation_verified', 'evidence_sanitised', 'critical_high_validated', 'remediation_guidance_attached', 'client_redaction_approved');--> statement-breakpoint
CREATE TYPE "public"."review_decision" AS ENUM('approve_release', 'hold_remediation', 'reject_archive');--> statement-breakpoint
CREATE TYPE "public"."review_gate_state" AS ENUM('not_eligible', 'in_review', 'approved_released', 'held_blocked', 'blocked_payment');--> statement-breakpoint
CREATE TYPE "public"."risk_flag" AS ENUM('legal_review_required', 'contains_pii', 'unverified_claim', 'brand_sensitive');--> statement-breakpoint
CREATE TYPE "public"."scan_environment" AS ENUM('production', 'staging');--> statement-breakpoint
CREATE TYPE "public"."scan_priority" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('queued', 'running', 'awaiting_review', 'completed', 'held', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."scan_type" AS ENUM('external', 'api', 'internal', 'network', 'mobile');--> statement-breakpoint
CREATE TYPE "public"."scope_category" AS ENUM('web_api', 'network_edge', 'endpoint_desktop', 'cloud_containers', 'mobile', 'ot_ics', 'identity_sso');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'past_due', 'canceled', 'incomplete');--> statement-breakpoint
CREATE TYPE "public"."team" AS ENUM('offensive_security', 'soc_detection_response', 'threat_intelligence', 'security_automation', 'compliance_audit', 'client_support', 'curriculum_product', 'compliance_comms');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'admin', 'security_analyst', 'soc_operator', 'compliance_auditor', 'support_engineer', 'client');--> statement-breakpoint
CREATE TYPE "public"."newsletter_status" AS ENUM('pending', 'confirmed', 'unsubscribed');--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"anonymous_id" uuid,
	"categories" jsonb NOT NULL,
	"policy_version" text NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consent_records_actor_check" CHECK (("consent_records"."user_id" is not null or "consent_records"."anonymous_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"client_code" text NOT NULL,
	"primary_domain" text,
	"industry" "industry",
	"country" char(2),
	"stripe_customer_id" text,
	"paystack_customer_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_client_code_unique" UNIQUE("client_code"),
	CONSTRAINT "organizations_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "organizations_paystack_customer_code_unique" UNIQUE("paystack_customer_code")
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid,
	"email" "citext" NOT NULL,
	"full_name" text NOT NULL,
	"job_title" text,
	"phone" text,
	"country" char(2),
	"account_type" "account_type",
	"role" "user_role" DEFAULT 'client' NOT NULL,
	"account_status" "account_status" DEFAULT 'active' NOT NULL,
	"team" "team",
	"access_tier" "access_tier" DEFAULT 'standard' NOT NULL,
	"base_location" text,
	"scope_summary" text,
	"scope_notes" text,
	"mfa_enrolled" boolean DEFAULT false NOT NULL,
	"mfa_methods" "mfa_method"[] DEFAULT '{}' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone,
	"access_review_due" date,
	"suspended_at" timestamp with time zone,
	"suspended_reason" text,
	"deleted_at" timestamp with time zone,
	"first_name" text,
	"last_name" text,
	"display_name" text,
	"timezone" text DEFAULT 'Africa/Nairobi' NOT NULL,
	"language" text DEFAULT 'en-GB' NOT NULL,
	"bio" text,
	"avatar_key" text,
	"require_2fa" boolean DEFAULT true NOT NULL,
	"last_password_change_at" timestamp with time zone,
	"last_factor_change_at" timestamp with time zone,
	"deactivation_requested_at" timestamp with time zone,
	"verified_blogger_at" timestamp with time zone,
	"verified_blogger_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email"),
	CONSTRAINT "profiles_language_supported" CHECK ("profiles"."language" IN ('en-GB', 'en-US', 'sw', 'fr')),
	CONSTRAINT "profiles_bio_length" CHECK ("profiles"."bio" IS NULL OR char_length("profiles"."bio") <= 400)
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"full_name" text NOT NULL,
	"job_title" text,
	"base_location" text,
	"role" "user_role" NOT NULL,
	"team" "team" NOT NULL,
	"access_tier" "access_tier" DEFAULT 'standard' NOT NULL,
	"scope_notes" text,
	"access_review_due" date,
	"invited_by" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"resend_count" integer DEFAULT 0 NOT NULL,
	"checklist" jsonb DEFAULT '{"mfaEnrolmentMandatory":true,"ndaOnFile":false,"backgroundVerified":false,"trainingAcknowledged":false}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "staff_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "webauthn_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" "bytea" NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"transports" text[] DEFAULT '{}' NOT NULL,
	"device_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "webauthn_credentials_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
ALTER TABLE "webauthn_credentials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pentest_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref_number" bigint GENERATED ALWAYS AS IDENTITY (sequence name "pentest_requests_ref_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"ref_code" text GENERATED ALWAYS AS ('VV-PT-' || lpad(ref_number::text, 6, '0')) STORED NOT NULL,
	"org_id" uuid,
	"requested_by" uuid,
	"target_url" text NOT NULL,
	"target_type" "pentest_target_type" NOT NULL,
	"preferred_schedule" timestamp with time zone,
	"notes" text,
	"status" "pentest_status" DEFAULT 'received' NOT NULL,
	"converted_job_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pentest_requests_ref_code_unique" UNIQUE("ref_code")
);
--> statement-breakpoint
ALTER TABLE "pentest_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "review_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"decision" "review_decision" NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"reviewer_role" "user_role" NOT NULL,
	"note" text NOT NULL,
	"gate_timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_decisions_note_length" CHECK (char_length("review_decisions"."note") >= 10)
);
--> statement-breakpoint
ALTER TABLE "review_decisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "review_gate_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"check_key" "review_check_key" NOT NULL,
	"passed" boolean DEFAULT false NOT NULL,
	"checked_by" uuid,
	"checked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "review_gate_checks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scan_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"severity" "finding_severity" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"evidence_redacted" text,
	"cvss" numeric(3, 1),
	"cwe" text,
	"status" "finding_status" DEFAULT 'open' NOT NULL,
	"validated_by" uuid,
	"validated_at" timestamp with time zone,
	"remediation_guidance" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scan_findings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scan_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_number" bigint GENERATED ALWAYS AS IDENTITY (sequence name "scan_jobs_job_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 4472 CACHE 1),
	"job_code" text GENERATED ALWAYS AS ('JOB-' || lpad(job_number::text, 4, '0')) STORED NOT NULL,
	"org_id" uuid NOT NULL,
	"requested_by" uuid,
	"requester_email" text,
	"target_host" text NOT NULL,
	"target_ip" text,
	"target_label" text,
	"environment" "scan_environment",
	"scan_type" "scan_type" NOT NULL,
	"priority" "scan_priority" DEFAULT 'medium' NOT NULL,
	"scope_notes" text,
	"status" "scan_status" DEFAULT 'queued' NOT NULL,
	"progress" smallint DEFAULT 0 NOT NULL,
	"eta_seconds" integer,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"review_gate_state" "review_gate_state" DEFAULT 'not_eligible' NOT NULL,
	"analyst_id" uuid,
	"assigned_reviewer_id" uuid,
	"released_at" timestamp with time zone,
	"released_by" uuid,
	"authorisation_doc_key" text,
	"authorisation_expires_at" timestamp with time zone,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"report_object_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_jobs_job_code_unique" UNIQUE("job_code"),
	CONSTRAINT "scan_jobs_progress_range" CHECK ("scan_jobs"."progress" >= 0 AND "scan_jobs"."progress" <= 100),
	CONSTRAINT "scan_jobs_release_lock_check" CHECK ("scan_jobs"."released_at" IS NULL OR "scan_jobs"."review_gate_state" = 'approved_released')
);
--> statement-breakpoint
ALTER TABLE "scan_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scan_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"queue_job_id" text,
	"pod_name" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"exit_code" integer,
	"abort_reason" text,
	"line_count" integer DEFAULT 0 NOT NULL,
	"bytes_streamed" bigint DEFAULT 0 NOT NULL,
	"redacted_log_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scan_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fx_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"display_currency" "display_currency" NOT NULL,
	"rate_local_per_usd" numeric(18, 8) NOT NULL,
	"usd_cents" bigint NOT NULL,
	"local_minor" bigint NOT NULL,
	"locked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "fx_quotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"plan_code" text,
	"product_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_usd_cents" bigint NOT NULL,
	"ledger_entry_id" uuid,
	CONSTRAINT "invoice_lines_quantity_positive" CHECK ("invoice_lines"."quantity" > 0),
	CONSTRAINT "invoice_lines_unit_non_negative" CHECK ("invoice_lines"."unit_usd_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "invoice_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"org_id" uuid NOT NULL,
	"status" "invoice_status" DEFAULT 'pending' NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone,
	"title" text NOT NULL,
	"detail" text,
	"settlement_currency" char(3) DEFAULT 'USD' NOT NULL,
	"pdf_object_key" text,
	"scan_job_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "invoices_settlement_usd" CHECK ("invoices"."settlement_currency" = 'USD')
);
--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" "journal_kind" NOT NULL,
	"memo" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reference_type" text,
	"reference_id" uuid,
	"idempotency_key" text NOT NULL,
	"reverses_entry_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_entries_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "journal_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" "ledger_account_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_accounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "ledger_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ledger_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"direction" "ledger_direction" NOT NULL,
	"amount_usd_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_lines_amount_positive" CHECK ("ledger_lines"."amount_usd_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "ledger_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"txn_number" bigint GENERATED ALWAYS AS IDENTITY (sequence name "payment_attempts_txn_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 90242 CACHE 1),
	"txn_code" text GENERATED ALWAYS AS ('VX-' || txn_number::text) STORED NOT NULL,
	"invoice_id" uuid NOT NULL,
	"fx_quote_id" uuid,
	"provider" "payment_provider" NOT NULL,
	"channel" "payment_channel" NOT NULL,
	"provider_reference" text,
	"status" "payment_attempt_status" DEFAULT 'created' NOT NULL,
	"usd_cents" bigint NOT NULL,
	"settlement_currency" char(3) DEFAULT 'USD' NOT NULL,
	"idempotency_key" text NOT NULL,
	"failure_code" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempts_txn_code_unique" UNIQUE("txn_code"),
	CONSTRAINT "payment_attempts_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "payment_attempts_amount_positive" CHECK ("payment_attempts"."usd_cents" > 0),
	CONSTRAINT "payment_attempts_settlement_usd" CHECK ("payment_attempts"."settlement_currency" = 'USD')
);
--> statement-breakpoint
ALTER TABLE "payment_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"provider_payment_method_id" text NOT NULL,
	"brand" text NOT NULL,
	"last4" char(4) NOT NULL,
	"exp_month" smallint NOT NULL,
	"exp_year" smallint NOT NULL,
	"cardholder_name" text,
	"billing_country" char(2),
	"is_default" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_methods_exp_month_range" CHECK ("payment_methods"."exp_month" BETWEEN 1 AND 12)
);
--> statement-breakpoint
ALTER TABLE "payment_methods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"unit" text DEFAULT 'month' NOT NULL,
	"monthly_usd_cents" bigint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "provider_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "provider_webhook_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "subscription_status" NOT NULL,
	"billing_cycle" "billing_cycle" NOT NULL,
	"amount_usd_cents" bigint NOT NULL,
	"settlement_currency" char(3) DEFAULT 'USD' NOT NULL,
	"renews_on" date NOT NULL,
	"provider" "payment_provider",
	"provider_subscription_id" text,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_settlement_usd" CHECK ("subscriptions"."settlement_currency" = 'USD')
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "broadcast_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_item_id" uuid NOT NULL,
	"severity_level" smallint NOT NULL,
	"status" "broadcast_status" DEFAULT 'queued' NOT NULL,
	"audience_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "broadcast_jobs_severity_range" CHECK ("broadcast_jobs"."severity_level" BETWEEN 1 AND 3)
);
--> statement-breakpoint
ALTER TABLE "broadcast_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" "citext" NOT NULL,
	"organization" text,
	"category" "contact_category" NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"consent" boolean NOT NULL,
	"status" "contact_status" DEFAULT 'new' NOT NULL,
	"assigned_to" uuid,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_messages_consent_required" CHECK ("contact_messages"."consent" = true)
);
--> statement-breakpoint
ALTER TABLE "contact_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "content_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "content_type" NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"body_md" text,
	"slug_path" text NOT NULL,
	"author_id" uuid NOT NULL,
	"author_team" "team",
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"category" "blog_category",
	"tags" text[] DEFAULT '{}' NOT NULL,
	"featured_image_key" text,
	"featured_image_url" text,
	"image_alt" text,
	"read_minutes" smallint,
	"excerpt" text,
	"risk_flags" "risk_flag"[] DEFAULT '{}' NOT NULL,
	"cve_id" text,
	"severity" "finding_severity",
	"submitted_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"scheduled_for" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_items_slug_path_unique" UNIQUE("slug_path"),
	CONSTRAINT "content_items_tags_max" CHECK (cardinality("content_items"."tags") <= 8),
	CONSTRAINT "content_items_excerpt_length" CHECK ("content_items"."excerpt" IS NULL OR char_length("content_items"."excerpt") <= 240)
);
--> statement-breakpoint
ALTER TABLE "content_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "content_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"action" "content_review_action" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"from_seq" bigint NOT NULL,
	"to_seq" bigint NOT NULL,
	"entries" bigint NOT NULL,
	"mismatches" integer DEFAULT 0 NOT NULL,
	"head_hash" char(64) NOT NULL,
	"verified_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_checkpoints" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_entries" (
	"seq" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_entries_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"category" "audit_category" NOT NULL,
	"event_type" text NOT NULL,
	"severity" "audit_severity" NOT NULL,
	"sev_level" smallint,
	"actor_id" uuid,
	"actor_label" text NOT NULL,
	"ip" "inet",
	"subject" text,
	"message" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sealed_details" "bytea",
	"nonce" "bytea",
	"prev_hash" char(64) NOT NULL,
	"hash" char(64) NOT NULL,
	"signature" char(64) NOT NULL,
	"key_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_entries_id_unique" UNIQUE("id"),
	CONSTRAINT "audit_entries_hash_unique" UNIQUE("hash"),
	CONSTRAINT "audit_entries_sev_level_range" CHECK ("audit_entries"."sev_level" IS NULL OR "audit_entries"."sev_level" BETWEEN 1 AND 3)
);
--> statement-breakpoint
ALTER TABLE "audit_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "advisories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cve_id" text NOT NULL,
	"vendor" text,
	"cvss" numeric(3, 1),
	"disclosure_date" date,
	"severity" "finding_severity",
	"weaponized" boolean DEFAULT false NOT NULL,
	"public_poc" boolean DEFAULT false NOT NULL,
	"pre_auth" boolean DEFAULT false NOT NULL,
	"patch_available" boolean DEFAULT false NOT NULL,
	"title" varchar(140),
	"summary" text,
	"remediation" text,
	"references" text[] DEFAULT '{}' NOT NULL,
	"scope" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "advisory_status" DEFAULT 'draft' NOT NULL,
	"patch_status" "advisory_patch_status" DEFAULT 'unpatched' NOT NULL,
	"author_id" uuid NOT NULL,
	"content_item_id" uuid,
	"last_saved_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"retracted_at" timestamp with time zone,
	"retraction_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advisories_cve_id_unique" UNIQUE("cve_id"),
	CONSTRAINT "advisories_cve_id_format" CHECK ("advisories"."cve_id" ~ '^CVE-\d{4}-\d{4,}$'),
	CONSTRAINT "advisories_cvss_range" CHECK ("advisories"."cvss" IS NULL OR "advisories"."cvss" BETWEEN 0 AND 10),
	CONSTRAINT "advisories_severity_matches_cvss" CHECK ((
  advisories.cvss IS NULL
  OR advisories.severity IS NULL
  OR (advisories.severity = 'critical' AND advisories.cvss BETWEEN 9.0 AND 10.0)
  OR (advisories.severity = 'high'     AND advisories.cvss BETWEEN 7.0 AND 8.9)
  OR (advisories.severity = 'medium'   AND advisories.cvss BETWEEN 4.0 AND 6.9)
  OR (advisories.severity = 'low'      AND advisories.cvss BETWEEN 0.1 AND 3.9)
)),
	CONSTRAINT "advisories_summary_length" CHECK ("advisories"."summary" IS NULL OR char_length("advisories"."summary") <= 1200),
	CONSTRAINT "advisories_remediation_length" CHECK ("advisories"."remediation" IS NULL OR char_length("advisories"."remediation") <= 900)
);
--> statement-breakpoint
ALTER TABLE "advisories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "advisory_acknowledgements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"advisory_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advisory_acknowledgements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "advisory_broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"advisory_id" uuid NOT NULL,
	"kind" "broadcast_kind" NOT NULL,
	"status" "broadcast_status" DEFAULT 'queued' NOT NULL,
	"triggered_by" uuid NOT NULL,
	"ack" jsonb NOT NULL,
	"audience_dashboards" integer DEFAULT 0 NOT NULL,
	"email_contacts" integer DEFAULT 0 NOT NULL,
	"sms_contacts" integer DEFAULT 0 NOT NULL,
	"sent_dashboards" integer DEFAULT 0 NOT NULL,
	"sent_email" integer DEFAULT 0 NOT NULL,
	"sent_sms" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"audit_seq" bigint,
	"queue_job_id" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advisory_broadcasts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "client_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"category" "scope_category" NOT NULL,
	"product" text NOT NULL,
	"version" text,
	"host" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "endpoint_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"requests" bigint DEFAULT 0 NOT NULL,
	"avg_latency_ms" integer DEFAULT 0 NOT NULL,
	"error_ratio" numeric(6, 4) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "endpoint_stats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "platform_metrics_hourly" (
	"hour" timestamp with time zone PRIMARY KEY NOT NULL,
	"site_sessions" integer DEFAULT 0 NOT NULL,
	"api_requests" bigint DEFAULT 0 NOT NULL,
	"avg_response_ms" integer DEFAULT 0 NOT NULL,
	"p95_response_ms" integer DEFAULT 0 NOT NULL,
	"threats_blocked" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_metrics_hourly" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sensor_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"country" text NOT NULL,
	"status" "node_status" DEFAULT 'operational' NOT NULL,
	"req_per_min" integer DEFAULT 0 NOT NULL,
	"load_percent" smallint DEFAULT 0 NOT NULL,
	"heartbeat_latency_ms" integer,
	"clock_drift_ms" integer,
	"missed_heartbeats" smallint DEFAULT 0 NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"public_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sensor_nodes_code_unique" UNIQUE("code"),
	CONSTRAINT "sensor_nodes_load_range" CHECK ("sensor_nodes"."load_percent" >= 0 AND "sensor_nodes"."load_percent" <= 100)
);
--> statement-breakpoint
ALTER TABLE "sensor_nodes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "threat_level_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"level" smallint NOT NULL,
	"active_zero_days" integer NOT NULL,
	"critical_cves" integer NOT NULL,
	"unpatched_critical" integer NOT NULL,
	"weaponized_in_wild" integer NOT NULL,
	"threats_blocked_ytd" bigint NOT NULL,
	CONSTRAINT "threat_level_snapshots_level_range" CHECK ("threat_level_snapshots"."level" BETWEEN 1 AND 5)
);
--> statement-breakpoint
ALTER TABLE "threat_level_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_hash" text NOT NULL,
	"ip" "inet" NOT NULL,
	"succeeded" boolean NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "login_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" uuid NOT NULL,
	"event" "notification_event" NOT NULL,
	"in_app" boolean NOT NULL,
	"email" boolean NOT NULL,
	"sms" boolean NOT NULL,
	"push" boolean NOT NULL,
	CONSTRAINT "notification_preferences_user_id_event_pk" PRIMARY KEY("user_id","event")
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notification_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"destination" text NOT NULL,
	"template" text,
	"status" text NOT NULL,
	"provider_message_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_receipts_status_known" CHECK ("notification_receipts"."status" IN ('sent', 'failed', 'skipped')),
	CONSTRAINT "notification_receipts_error_length" CHECK (char_length("notification_receipts"."error") <= 300)
);
--> statement-breakpoint
ALTER TABLE "notification_receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"quiet_hours_enabled" boolean DEFAULT false NOT NULL,
	"quiet_from" time,
	"quiet_to" time
);
--> statement-breakpoint
ALTER TABLE "notification_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event" "notification_event" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_title_length" CHECK (char_length("notifications"."title") <= 140),
	CONSTRAINT "notifications_body_length" CHECK (char_length("notifications"."body") <= 600)
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "onboarding_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"date_of_birth" date,
	"career" "career_role",
	"entity" "entity_type",
	"recovery_question" "recovery_question",
	"recovery_answer_hash" text,
	"declarations" jsonb DEFAULT '{"infoAccurate":false,"authorisedTesting":false,"termsAccepted":false}'::jsonb NOT NULL,
	"terms_version" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_profiles_min_age" CHECK ("onboarding_profiles"."date_of_birth" IS NULL OR "onboarding_profiles"."date_of_birth" <= current_date - interval '16 years')
);
--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_recovery_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"device_label" text NOT NULL,
	"user_agent" text,
	"ip" "inet",
	"geo_city" text,
	"geo_country" char(2),
	"mfa_method" "mfa_method",
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "newsletter_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"status" "newsletter_status" DEFAULT 'pending' NOT NULL,
	"token_hash" text NOT NULL,
	"source" text,
	"ip_hash" text,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsletter_subscribers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"license_key" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updates_until" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "product_entitlements_license_key_unique" UNIQUE("license_key"),
	CONSTRAINT "product_entitlements_license_key_format" CHECK ("product_entitlements"."license_key" ~ '^VV-[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$'),
	CONSTRAINT "product_entitlements_updates_after_grant" CHECK ("product_entitlements"."updates_until" > "product_entitlements"."granted_at")
);
--> statement-breakpoint
ALTER TABLE "product_entitlements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"features" text[] DEFAULT '{}' NOT NULL,
	"price_usd_cents" bigint NOT NULL,
	"unit_label" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"delivery_object_key" text,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_price_positive" CHECK ("products"."price_usd_cents" > 0),
	CONSTRAINT "products_unit_label_allowed" CHECK ("products"."unit_label" IN ('license', 'year', 'pack'))
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_verified_blogger_by_profiles_id_fk" FOREIGN KEY ("verified_blogger_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pentest_requests" ADD CONSTRAINT "pentest_requests_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pentest_requests" ADD CONSTRAINT "pentest_requests_requested_by_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pentest_requests" ADD CONSTRAINT "pentest_requests_converted_job_id_scan_jobs_id_fk" FOREIGN KEY ("converted_job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_job_id_scan_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_reviewer_id_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_gate_checks" ADD CONSTRAINT "review_gate_checks_job_id_scan_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_gate_checks" ADD CONSTRAINT "review_gate_checks_checked_by_profiles_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_findings" ADD CONSTRAINT "scan_findings_job_id_scan_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_findings" ADD CONSTRAINT "scan_findings_validated_by_profiles_id_fk" FOREIGN KEY ("validated_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_requested_by_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_analyst_id_profiles_id_fk" FOREIGN KEY ("analyst_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_assigned_reviewer_id_profiles_id_fk" FOREIGN KEY ("assigned_reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_released_by_profiles_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_runs" ADD CONSTRAINT "scan_runs_job_id_scan_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD CONSTRAINT "fx_quotes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD CONSTRAINT "fx_quotes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_plan_code_plans_code_fk" FOREIGN KEY ("plan_code") REFERENCES "public"."plans"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_ledger_entry_id_journal_entries_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_scan_job_id_scan_jobs_id_fk" FOREIGN KEY ("scan_job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_lines" ADD CONSTRAINT "ledger_lines_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_lines" ADD CONSTRAINT "ledger_lines_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_fx_quote_id_fx_quotes_id_fk" FOREIGN KEY ("fx_quote_id") REFERENCES "public"."fx_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_jobs" ADD CONSTRAINT "broadcast_jobs_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_jobs" ADD CONSTRAINT "broadcast_jobs_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_assigned_to_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_item_id_content_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_reviewer_id_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisories" ADD CONSTRAINT "advisories_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisories" ADD CONSTRAINT "advisories_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisory_acknowledgements" ADD CONSTRAINT "advisory_acknowledgements_advisory_id_advisories_id_fk" FOREIGN KEY ("advisory_id") REFERENCES "public"."advisories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisory_acknowledgements" ADD CONSTRAINT "advisory_acknowledgements_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisory_acknowledgements" ADD CONSTRAINT "advisory_acknowledgements_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisory_broadcasts" ADD CONSTRAINT "advisory_broadcasts_advisory_id_advisories_id_fk" FOREIGN KEY ("advisory_id") REFERENCES "public"."advisories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisory_broadcasts" ADD CONSTRAINT "advisory_broadcasts_triggered_by_profiles_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_assets" ADD CONSTRAINT "client_assets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD CONSTRAINT "onboarding_profiles_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_recovery_codes" ADD CONSTRAINT "user_recovery_codes_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_entitlements" ADD CONSTRAINT "product_entitlements_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_entitlements" ADD CONSTRAINT "product_entitlements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_entitlements" ADD CONSTRAINT "product_entitlements_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organizations_name_lower_idx" ON "organizations" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "profiles_role_idx" ON "profiles" USING btree ("role");--> statement-breakpoint
CREATE INDEX "profiles_account_status_idx" ON "profiles" USING btree ("account_status");--> statement-breakpoint
CREATE INDEX "profiles_org_id_idx" ON "profiles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "profiles_last_active_at_idx" ON "profiles" USING btree ("last_active_at");--> statement-breakpoint
CREATE INDEX "staff_invitations_status_expires_at_idx" ON "staff_invitations" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "staff_invitations_email_idx" ON "staff_invitations" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "review_gate_checks_job_id_check_key_idx" ON "review_gate_checks" USING btree ("job_id","check_key");--> statement-breakpoint
CREATE INDEX "scan_findings_job_id_severity_idx" ON "scan_findings" USING btree ("job_id","severity");--> statement-breakpoint
CREATE INDEX "scan_jobs_status_idx" ON "scan_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scan_jobs_review_gate_state_idx" ON "scan_jobs" USING btree ("review_gate_state");--> statement-breakpoint
CREATE INDEX "scan_jobs_payment_status_idx" ON "scan_jobs" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "scan_jobs_analyst_id_idx" ON "scan_jobs" USING btree ("analyst_id");--> statement-breakpoint
CREATE INDEX "scan_jobs_org_requested_idx" ON "scan_jobs" USING btree ("org_id","requested_at" DESC);--> statement-breakpoint
CREATE INDEX "scan_jobs_requested_at_idx" ON "scan_jobs" USING btree ("requested_at" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX "scan_runs_job_id_attempt_idx" ON "scan_runs" USING btree ("job_id","attempt");--> statement-breakpoint
CREATE INDEX "fx_quotes_invoice_currency_idx" ON "fx_quotes" USING btree ("invoice_id","display_currency");--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoices_org_issued_idx" ON "invoices" USING btree ("org_id","issued_at" DESC);--> statement-breakpoint
CREATE INDEX "ledger_lines_entry_id_idx" ON "ledger_lines" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "ledger_lines_account_id_idx" ON "ledger_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "payment_attempts_invoice_idx" ON "payment_attempts" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_provider_pm_idx" ON "payment_methods" USING btree ("provider","provider_payment_method_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_webhook_events_provider_event_idx" ON "provider_webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "subscriptions_org_id_idx" ON "subscriptions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "broadcast_jobs_status_idx" ON "broadcast_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contact_messages_status_created_idx" ON "contact_messages" USING btree ("status","created_at" DESC);--> statement-breakpoint
CREATE INDEX "content_items_status_idx" ON "content_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "content_items_type_idx" ON "content_items" USING btree ("type");--> statement-breakpoint
CREATE INDEX "content_items_submitted_at_idx" ON "content_items" USING btree ("submitted_at" DESC);--> statement-breakpoint
CREATE INDEX "content_items_category_idx" ON "content_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "content_items_type_severity_published_idx" ON "content_items" USING btree ("type","severity","published_at" DESC);--> statement-breakpoint
CREATE INDEX "audit_entries_created_at_idx" ON "audit_entries" USING btree ("created_at" DESC);--> statement-breakpoint
CREATE INDEX "audit_entries_category_created_idx" ON "audit_entries" USING btree ("category","created_at" DESC);--> statement-breakpoint
CREATE INDEX "audit_entries_severity_created_idx" ON "audit_entries" USING btree ("severity","created_at" DESC);--> statement-breakpoint
CREATE INDEX "audit_entries_actor_created_idx" ON "audit_entries" USING btree ("actor_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "audit_entries_event_type_idx" ON "audit_entries" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "advisories_status_published_idx" ON "advisories" USING btree ("status","published_at" DESC);--> statement-breakpoint
CREATE INDEX "advisories_severity_idx" ON "advisories" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "advisories_author_status_idx" ON "advisories" USING btree ("author_id","status");--> statement-breakpoint
CREATE INDEX "advisories_weaponized_idx" ON "advisories" USING btree ("weaponized") WHERE "advisories"."weaponized" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "advisory_acknowledgements_advisory_org_idx" ON "advisory_acknowledgements" USING btree ("advisory_id","org_id");--> statement-breakpoint
CREATE INDEX "advisory_broadcasts_advisory_created_idx" ON "advisory_broadcasts" USING btree ("advisory_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "client_assets_org_id_idx" ON "client_assets" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "client_assets_category_idx" ON "client_assets" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "endpoint_stats_endpoint_window_idx" ON "endpoint_stats" USING btree ("endpoint","window_start");--> statement-breakpoint
CREATE INDEX "sensor_nodes_status_idx" ON "sensor_nodes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "threat_level_snapshots_computed_at_idx" ON "threat_level_snapshots" USING btree ("computed_at" DESC);--> statement-breakpoint
CREATE INDEX "login_attempts_email_created_idx" ON "login_attempts" USING btree ("email_hash","created_at" DESC);--> statement-breakpoint
CREATE INDEX "login_attempts_ip_created_idx" ON "login_attempts" USING btree ("ip","created_at" DESC);--> statement-breakpoint
CREATE INDEX "notification_receipts_created_idx" ON "notification_receipts" USING btree ("created_at" DESC);--> statement-breakpoint
CREATE INDEX "notification_receipts_channel_status_idx" ON "notification_receipts" USING btree ("channel","status");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" IS NULL;--> statement-breakpoint
CREATE INDEX "user_recovery_codes_user_batch_idx" ON "user_recovery_codes" USING btree ("user_id","batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_recovery_codes_user_code_idx" ON "user_recovery_codes" USING btree ("user_id","code_hash");--> statement-breakpoint
CREATE INDEX "user_sessions_user_revoked_idx" ON "user_sessions" USING btree ("user_id","revoked_at");--> statement-breakpoint
CREATE INDEX "newsletter_subscribers_status_idx" ON "newsletter_subscribers" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "product_entitlements_org_product_invoice_idx" ON "product_entitlements" USING btree ("org_id","product_id","invoice_id");--> statement-breakpoint
CREATE INDEX "product_entitlements_org_id_idx" ON "product_entitlements" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "products_active_sort_idx" ON "products" USING btree ("active","sort_order");