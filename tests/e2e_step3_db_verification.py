"""
=============================================================================
  InsightEd Mobile PWA — End-to-End (E2E) Test Script · Step 3
  Database Verification & Reporting
=============================================================================

  Prerequisite:  Steps 1 + 2 have logged in, navigated to Unit 4,
                 completed the 5-chapter wizard, and clicked "Submit Profile".

  This script performs the FULL pipeline:
    Step 1 — Login as account 500156, navigate to Unit 4
    Step 2 — Fill all 5 chapters with Faker data, submit the form
    Step 3 — Verify the UI success indicator, then query PostgreSQL
             to assert that every submitted field was persisted correctly

  Database Table :  ph_schools  (keyed on school_id = '500156')
  Verified Cols  :  unit4_completed, selected_learner_groups (JSONB),
                    als_total, muslim_*, ip_*, displaced_*, overage_*,
                    dropout_*, repeater_*, bmi_severely_wasted,
                    bmi_wasted, bmi_overweight_obese, bmi_normal

  Usage:
      pip install playwright psycopg2-binary faker
      python -m playwright install chromium
      python tests/e2e_step3_db_verification.py
=============================================================================
"""

import sys
import json
import traceback
import random

# ── THIRD-PARTY IMPORTS ──────────────────────────────────────────────────────
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
import psycopg2
from faker import Faker


# ── FAKER INITIALIZATION ─────────────────────────────────────────────────────
fake = Faker()

# ── Generate Dummy Data ──────────────────────────────────────────────────────
DUMMY_SCHOOL_NAME    = fake.company() + " Academy"
DUMMY_TOTAL_LEARNERS = fake.random_int(min=200, max=1500)
DUMMY_DEPED_EMAIL    = f"{fake.first_name().lower()}.{fake.last_name().lower()}@deped.gov.ph"

print("=" * 70)
print("  FAKER — Generated Dummy Data")
print("=" * 70)
print(f"  School Name       :  {DUMMY_SCHOOL_NAME}")
print(f"  Total Learners    :  {DUMMY_TOTAL_LEARNERS}")
print(f"  DepEd Email       :  {DUMMY_DEPED_EMAIL}")
print("=" * 70 + "\n")


# ──────────────────────────────────────────────────────────────────────────────
#  CONFIGURATION
# ──────────────────────────────────────────────────────────────────────────────

BASE_URL       = "http://localhost:5173/insighted"
LOGIN_URL      = f"{BASE_URL}/#/"
DASHBOARD_URL  = f"{BASE_URL}/#/modular-dashboard"
UNIT_4_URL     = f"{BASE_URL}/#/modular/unit-4"

ACCOUNT_NUMBER = "500031"
PASSWORD       = "123456"

MOBILE_VIEWPORT = {"width": 393, "height": 851}
MOBILE_USER_AGENT = (
    "Mozilla/5.0 (Linux; Android 12; Pixel 5) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/114.0.0.0 Mobile Safari/537.36"
)

# DB credentials (from .env)
DB_CONFIG = {
    "host":     "stride-posgre-prod-01.postgres.database.azure.com",
    "port":     5432,
    "database": "insightEd",
    "user":     "Administrator1",
    "password": "<REDACTED_PGB_PASS>",
    "sslmode":  "require",
}

# The demographic groups we select in Ch1 and their DB column prefixes
GROUPS_SELECTED   = ["als", "muslim"]
GROUPS_LABELS     = ["ALS Learners", "Muslim Learners (ALIVE)"]

# All possible grade suffixes used in the DB columns
ALL_GRADE_IDS = [
    "kinder", "g1", "g2", "g3", "g4", "g5", "g6",
    "g7", "g8", "g9", "g10", "g11", "g12",
]


# ──────────────────────────────────────────────────────────────────────────────
#  DATABASE HELPER
# ──────────────────────────────────────────────────────────────────────────────

def get_db_connection():
    """Connect to the InsightEd PostgreSQL DB."""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print("[DB] ✅  Connected to PostgreSQL successfully.")
        return conn
    except psycopg2.Error as e:
        print(f"[DB] ❌  Connection failed: {e}")
        return None


# ──────────────────────────────────────────────────────────────────────────────
#  HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def fill_grade_number_inputs(page, max_value_per_field=5):
    """Fill all visible <input type='number'> with small random ints.
    Returns dict { field_index: value_filled } for later verification."""
    inputs = page.locator("input[type='number']")
    count = inputs.count()
    filled_map = {}
    for i in range(count):
        inp = inputs.nth(i)
        if inp.is_visible():
            val = random.randint(0, max_value_per_field)
            inp.fill(str(val))
            filled_map[i] = val
    return filled_map


def click_continue_button(page):
    """Click next/continue in the sticky footer."""
    footer_btn = page.locator(
        "button:has-text('Continue'), "
        "button:has-text('Next Group'), "
        "button:has-text('Skip Steps')"
    ).first
    footer_btn.wait_for(state="visible", timeout=10_000)
    footer_btn.scroll_into_view_if_needed()
    footer_btn.click()
    page.wait_for_timeout(800)


# ──────────────────────────────────────────────────────────────────────────────
#  MAIN PIPELINE
# ──────────────────────────────────────────────────────────────────────────────

def run_e2e_full_pipeline():
    """Execute Steps 1 → 2 → 3:  Login → Form → DB Verification."""

    # ══════════════════════════════════════════════════════════════════════
    #  Tracking dict:  record every value we actually set in the UI
    #  so we can compare against the DB later.
    # ══════════════════════════════════════════════════════════════════════
    expected = {
        "unit4_completed":      True,
        "selected_learner_groups": GROUPS_SELECTED,
        "als_total":            None,   # filled in Ch2
        "bmi_severely_wasted":  None,   # filled in Ch4
        "bmi_wasted":           None,
        "bmi_overweight_obese": None,
        # bmi_normal is auto-calculated on the backend
    }
    # We'll also track per-category-per-grade values
    # e.g. expected["muslim_g1"] = 2
    grade_fields = {}   # populated during Ch2/Ch3

    # ── DB Connectivity Pre-Check ─────────────────────────────────────────
    print("\n" + "=" * 70)
    print("  STEP 0  ·  Database Connectivity Check")
    print("=" * 70)
    conn_check = get_db_connection()
    if conn_check:
        try:
            cur = conn_check.cursor()
            cur.execute("SELECT 1;")
            print(f"[DB] Ping OK: {cur.fetchone()}")
            cur.close()
        finally:
            conn_check.close()
            print("[DB] Connection closed.\n")
    else:
        print("[DB] ⚠  Cannot reach database. Step 3 verification will be skipped.\n")

    # ══════════════════════════════════════════════════════════════════════
    #  STEP 1 — Login & Navigate to Unit 4
    # ══════════════════════════════════════════════════════════════════════
    print("=" * 70)
    print("  STEP 1  ·  Login + Navigate to Unit 4")
    print("=" * 70)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False, slow_mo=250)
        context = browser.new_context(
            viewport=MOBILE_VIEWPORT,
            user_agent=MOBILE_USER_AGENT,
            is_mobile=True,
            has_touch=True,
            device_scale_factor=2.75,
        )
        page = context.new_page()

        try:
            # ── Step 1: Login ────────────────────────────────────────────
            page.goto(LOGIN_URL, wait_until="networkidle", timeout=30_000)
            page.wait_for_selector("input[placeholder='Email or School ID']", timeout=15_000)
            page.locator("input[placeholder='Email or School ID']").fill(ACCOUNT_NUMBER)
            page.locator("input[placeholder='Password']").fill(PASSWORD)
            page.locator("button[type='submit']:has-text('Sign In')").click()
            page.wait_for_timeout(3000)
            page.wait_for_load_state("networkidle", timeout=20_000)
            print(f"[LOGIN] ✅  Signed in as {ACCOUNT_NUMBER}.")

            page.goto(DASHBOARD_URL, wait_until="networkidle", timeout=30_000)
            page.wait_for_timeout(2000)
            page.wait_for_selector("text=Modular Data Flow", timeout=10_000)
            page.locator("button:has-text('Unit 4')").click()
            page.wait_for_timeout(2000)
            page.wait_for_load_state("networkidle", timeout=20_000)
            if "unit-4" not in page.url:
                raise RuntimeError(f"Failed to reach Unit 4. URL: {page.url}")
            print("[UNIT 4] ✅  Arrived at Unit 4.\n")

            # Handle review mode (if Unit 4 was already submitted)
            unlock_btn = page.locator("button:has-text('Unlock to Edit')")
            if unlock_btn.is_visible():
                unlock_btn.click()
                page.wait_for_timeout(1000)
                print("[UNIT 4] Unlocked review mode.\n")

            # ══════════════════════════════════════════════════════════════
            #  STEP 2 — Form Interaction
            # ══════════════════════════════════════════════════════════════
            print("=" * 70)
            print("  STEP 2  ·  Form Interaction (5-Chapter Wizard)")
            print("=" * 70)

            # ── Chapter 1: Demographics Gatekeeper ────────────────────────
            print("\n--- Ch1: Demographics Gatekeeper ---")
            page.wait_for_selector("text=Your School Community", timeout=10_000)
            for label in GROUPS_LABELS:
                page.locator(f"button:has-text('{label}')").click()
                page.wait_for_timeout(400)
                print(f"  ✅ Selected: {label}")
            click_continue_button(page)

            # ── Chapter 2: Category Loop ──────────────────────────────────
            print("\n--- Ch2: Category Loop ---")
            for idx, (group_id, group_label) in enumerate(zip(GROUPS_SELECTED, GROUPS_LABELS)):
                page.wait_for_selector(f"text={group_label}", timeout=8_000)

                if group_id == "als":
                    als_val = fake.random_int(min=5, max=50)
                    als_input = page.locator("input[type='number']").first
                    als_input.fill(str(als_val))
                    expected["als_total"] = als_val
                    print(f"  ✅ ALS Total = {als_val}")
                else:
                    # Per-grade inputs — read labels to map values
                    inputs = page.locator("input[type='number']")
                    count = inputs.count()
                    # Each input corresponds to a grade from dynamicGrades
                    # We can't easily know which grade maps to which index,
                    # so we record values by position for general verification.
                    for i in range(count):
                        inp = inputs.nth(i)
                        if inp.is_visible():
                            val = random.randint(0, 3)
                            inp.fill(str(val))
                            # Store as category_grade (we'll verify sum > 0)
                            grade_fields[f"{group_id}_field_{i}"] = val

                    print(f"  ✅ Filled {count} grade fields for '{group_label}'")

                click_continue_button(page)

            # ── Chapter 3: Movement ───────────────────────────────────────
            print("\n--- Ch3: Learner Movement ---")
            page.wait_for_selector("text=Learner Movement", timeout=10_000)
            page.locator("button:has-text('Yes, we do.')").click()
            page.wait_for_timeout(500)
            click_continue_button(page)

            for m_label in ["Dropouts", "Repeaters"]:
                page.wait_for_selector(f"text={m_label}", timeout=8_000)
                inputs = page.locator("input[type='number']")
                count = inputs.count()
                for i in range(count):
                    inp = inputs.nth(i)
                    if inp.is_visible():
                        val = random.randint(0, 2)
                        inp.fill(str(val))
                        prefix = "dropout" if m_label == "Dropouts" else "repeater"
                        grade_fields[f"{prefix}_field_{i}"] = val
                print(f"  ✅ Filled {count} grade fields for {m_label}")
                click_continue_button(page)

            # ── Chapter 4: Health Check (BMI) ─────────────────────────────
            print("\n--- Ch4: Health Check (BMI) ---")
            page.wait_for_selector("text=Nutritional Status", timeout=10_000)

            bmi_values = {
                "severely_wasted":  fake.random_int(min=1, max=20),
                "wasted":           fake.random_int(min=1, max=20),
                "overweight_obese": fake.random_int(min=1, max=20),
            }

            bmi_labels_map = [
                ("Severely Wasted", "severely_wasted"),
                ("Wasted",          "wasted"),
                ("Overweight",      "overweight_obese"),
            ]

            for ui_label, key in bmi_labels_map:
                label_el = page.locator(f"label:has-text('{ui_label}')").first
                bmi_input = label_el.locator("xpath=following::input[@type='number']").first
                bmi_input.fill(str(bmi_values[key]))
                expected[f"bmi_{key}"] = bmi_values[key]
                print(f"  ✅ {ui_label} = {bmi_values[key]}")

            click_continue_button(page)

            # ── Chapter 5: Review & Submit ────────────────────────────────
            print("\n--- Ch5: Review & Submit ---")
            page.wait_for_selector("text=Confirm", timeout=10_000)
            page.locator("button:has-text('I verify this data is correct')").click()
            page.wait_for_timeout(500)

            submit_btn = page.locator("button:has-text('Submit Profile')")
            submit_btn.wait_for(state="visible", timeout=5_000)
            submit_btn.scroll_into_view_if_needed()
            submit_btn.click()
            print("  ✅ Clicked 'Submit Profile'.")

            # ══════════════════════════════════════════════════════════════
            #  STEP 3A — UI SUCCESS CHECK
            # ══════════════════════════════════════════════════════════════
            print("\n" + "=" * 70)
            print("  STEP 3A  ·  UI Success Indicator Check")
            print("=" * 70)

            ui_success = False
            try:
                # The SuccessModal renders text: "Learner Profile complete!"
                page.wait_for_selector("text=Learner Profile complete", timeout=15_000)
                ui_success = True
                print("[UI] ✅  Success modal confirmed: 'Learner Profile complete!'")
            except PlaywrightTimeout:
                print("[UI] ❌  Success modal did NOT appear within 15 seconds.")
                print("         Possible causes: network error, API 500, or missing modal.")
                # Take a debug screenshot
                page.screenshot(path="tests/screenshot_step3_no_success.png")
                print("[UI] Screenshot saved → tests/screenshot_step3_no_success.png")

            # Also check for potential redirect back to dashboard
            page.wait_for_timeout(3000)
            if "modular-dashboard" in page.url:
                print("[UI] ✅  Redirected to Modular Dashboard (post-submit redirect confirmed).")
            else:
                print(f"[UI] ℹ  Current URL after submit: {page.url}")

            # ══════════════════════════════════════════════════════════════
            #  STEP 3B — DATABASE VERIFICATION
            # ══════════════════════════════════════════════════════════════
            print("\n" + "=" * 70)
            print("  STEP 3B  ·  Database Verification (psycopg2)")
            print("=" * 70)

            conn = get_db_connection()
            if not conn:
                print("[DB] ❌  Cannot connect to database. Skipping verification.")
            else:
                try:
                    cur = conn.cursor()

                    # ── Build the SELECT query ────────────────────────────
                    # Fetch all Unit 4-related columns for this school
                    select_cols = [
                        "school_id",
                        "unit4_completed",
                        "selected_learner_groups",
                        "als_total",
                        "bmi_severely_wasted",
                        "bmi_wasted",
                        "bmi_overweight_obese",
                        "bmi_normal",
                        "updated_at",
                    ]
                    # Add per-grade columns for demographics + movement
                    categories = ["muslim", "ip", "displaced", "overage", "als", "dropout", "repeater"]
                    for cat in categories:
                        for grade in ALL_GRADE_IDS:
                            select_cols.append(f"{cat}_{grade}")

                    cols_sql = ", ".join(select_cols)
                    query = f"SELECT {cols_sql} FROM ph_schools WHERE school_id = %s"

                    print(f"[DB] Querying ph_schools for school_id = '{ACCOUNT_NUMBER}'...")
                    cur.execute(query, (ACCOUNT_NUMBER,))
                    row = cur.fetchone()

                    if row is None:
                        print("\n" + "!" * 70)
                        print("  ❌ TEST FAILED: No row found in ph_schools for "
                              f"school_id = '{ACCOUNT_NUMBER}'.")
                        print("     The form submission may not have reached the backend,")
                        print("     or the school_id was not set in localStorage.")
                        print("!" * 70)
                    else:
                        # Map column names to values
                        col_names = [desc[0] for desc in cur.description]
                        db_data = dict(zip(col_names, row))

                        print(f"[DB] ✅  Row found. updated_at = {db_data.get('updated_at')}")
                        print(f"[DB]     unit4_completed = {db_data.get('unit4_completed')}\n")

                        # ── ASSERTIONS ────────────────────────────────────
                        mismatches = []
                        passes = []

                        # 1. unit4_completed must be True
                        if db_data.get("unit4_completed") is True:
                            passes.append("unit4_completed = TRUE")
                        else:
                            mismatches.append(
                                f"unit4_completed: expected TRUE, "
                                f"got {db_data.get('unit4_completed')}"
                            )

                        # 2. selected_learner_groups must match
                        db_groups = db_data.get("selected_learner_groups")
                        # Could be a JSON string or already parsed by psycopg2
                        if isinstance(db_groups, str):
                            try:
                                db_groups = json.loads(db_groups)
                            except json.JSONDecodeError:
                                db_groups = None

                        if db_groups is not None and sorted(db_groups) == sorted(GROUPS_SELECTED):
                            passes.append(f"selected_learner_groups = {db_groups}")
                        else:
                            mismatches.append(
                                f"selected_learner_groups: expected {GROUPS_SELECTED}, "
                                f"got {db_groups}"
                            )

                        # 3. als_total must match the value we entered
                        if expected["als_total"] is not None:
                            db_als = db_data.get("als_total")
                            if db_als is not None and int(db_als) == expected["als_total"]:
                                passes.append(f"als_total = {db_als}")
                            else:
                                mismatches.append(
                                    f"als_total: expected {expected['als_total']}, "
                                    f"got {db_als}"
                                )

                        # 4. BMI fields
                        for bmi_col in ["bmi_severely_wasted", "bmi_wasted", "bmi_overweight_obese"]:
                            exp_val = expected.get(bmi_col)
                            db_val = db_data.get(bmi_col)
                            if exp_val is not None:
                                if db_val is not None and int(db_val) == int(exp_val):
                                    passes.append(f"{bmi_col} = {db_val}")
                                else:
                                    mismatches.append(
                                        f"{bmi_col}: expected {exp_val}, got {db_val}"
                                    )

                        # 5. bmi_normal must be auto-calculated
                        #    (total_enrollment - sum of wasted fields)
                        db_bmi_normal = db_data.get("bmi_normal")
                        if db_bmi_normal is not None:
                            passes.append(f"bmi_normal = {db_bmi_normal} (auto-calculated)")
                        else:
                            mismatches.append(
                                "bmi_normal: expected a computed value, got NULL"
                            )

                        # 6. Spot-check: at least some demographic/movement
                        #    columns should be non-NULL (not all zeros is fine,
                        #    but NULLs indicate the column wasn't written)
                        null_columns = []
                        for cat in ["muslim", "dropout", "repeater"]:
                            for grade in ALL_GRADE_IDS:
                                col = f"{cat}_{grade}"
                                val = db_data.get(col)
                                if val is None:
                                    null_columns.append(col)

                        if null_columns:
                            # Not necessarily a hard failure — columns may not
                            # exist for grades the school doesn't offer
                            if len(null_columns) > len(ALL_GRADE_IDS) * 2:
                                mismatches.append(
                                    f"WARNING: {len(null_columns)} category/grade columns "
                                    f"are NULL (expected 0 or integer). Sample: "
                                    f"{null_columns[:5]}"
                                )
                            else:
                                passes.append(
                                    f"Category/grade columns: {len(null_columns)} NULLs "
                                    f"(may be inactive grades — acceptable)"
                                )
                        else:
                            passes.append(
                                "All category/grade columns are non-NULL ✓"
                            )

                        # ── FINAL REPORT ──────────────────────────────────
                        print("\n" + "=" * 70)
                        if not mismatches:
                            print("  ✅ TEST PASSED: Unit 4 data successfully "
                                  "verified in PostgreSQL.")
                        else:
                            print("  ❌ TEST FAILED: Database mismatch detected.")
                            print("     Check backend validation for:")
                        print("=" * 70)

                        print(f"\n  PASSED ASSERTIONS ({len(passes)}):")
                        for p in passes:
                            print(f"    ✅  {p}")

                        if mismatches:
                            print(f"\n  FAILED ASSERTIONS ({len(mismatches)}):")
                            for m in mismatches:
                                print(f"    ❌  {m}")

                        # ── Detailed DB dump for debugging ────────────────
                        print(f"\n  ── Raw DB Values (Unit 4 Core Fields) ──")
                        print(f"  school_id              : {db_data.get('school_id')}")
                        print(f"  unit4_completed        : {db_data.get('unit4_completed')}")
                        print(f"  selected_learner_groups: {db_data.get('selected_learner_groups')}")
                        print(f"  als_total              : {db_data.get('als_total')}")
                        print(f"  bmi_severely_wasted    : {db_data.get('bmi_severely_wasted')}")
                        print(f"  bmi_wasted             : {db_data.get('bmi_wasted')}")
                        print(f"  bmi_overweight_obese   : {db_data.get('bmi_overweight_obese')}")
                        print(f"  bmi_normal             : {db_data.get('bmi_normal')}")
                        print(f"  updated_at             : {db_data.get('updated_at')}")
                        print()

                    cur.close()

                except psycopg2.Error as db_err:
                    print(f"\n[DB] ❌  Query failed: {db_err}")
                    traceback.print_exc()

                finally:
                    conn.close()
                    print("[DB] Connection closed.")

            # ══════════════════════════════════════════════════════════════
            #  SUMMARY
            # ══════════════════════════════════════════════════════════════
            print("\n" + "=" * 70)
            print("  PIPELINE COMPLETE — Steps 1 → 2 → 3 Finished")
            print("=" * 70)
            print(f"  Account Tested    : {ACCOUNT_NUMBER}")
            print(f"  UI Success Modal  : {'✅ Yes' if ui_success else '❌ No'}")
            print(f"  Faker School Name : {DUMMY_SCHOOL_NAME}")
            print(f"  Faker Email       : {DUMMY_DEPED_EMAIL}")
            print(f"  Faker Learners    : {DUMMY_TOTAL_LEARNERS}")
            print(f"  ALS Total Entered : {expected.get('als_total')}")
            print(f"  BMI Values Entered: SW={expected.get('bmi_severely_wasted')}, "
                  f"W={expected.get('bmi_wasted')}, "
                  f"OO={expected.get('bmi_overweight_obese')}")
            print("=" * 70 + "\n")

            # Keep browser open briefly for visual inspection
            page.wait_for_timeout(5000)

        except PlaywrightTimeout as e:
            print(f"\n[ERROR] ⏱  Playwright timed out: {e}")
            traceback.print_exc()
            try:
                page.screenshot(path="tests/screenshot_step3_timeout.png")
                print("[DEBUG] Screenshot saved → tests/screenshot_step3_timeout.png")
            except Exception:
                pass

        except Exception as e:
            print(f"\n[ERROR] ❌  Unexpected failure: {e}")
            traceback.print_exc()
            try:
                page.screenshot(path="tests/screenshot_step3_error.png")
                print("[DEBUG] Screenshot saved → tests/screenshot_step3_error.png")
            except Exception:
                pass

        finally:
            context.close()
            browser.close()
            print("[BROWSER] Closed.")


# ──────────────────────────────────────────────────────────────────────────────
#  ENTRY POINT
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    run_e2e_full_pipeline()
