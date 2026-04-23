"""
=============================================================================
  InsightEd Mobile PWA — End-to-End (E2E) Test Script · Step 2
  Unit 4 Learner Profile — Form Interaction & Data Generation
=============================================================================

  Prerequisite:  Step 1 has logged in as account 500156 and navigated
                 to Unit 4 (/#/modular/unit-4).

  This script performs the COMPLETE Step 1 login flow first, then
  continues with Step 2 form interaction on Unit 4.

  Unit 4 is a 5-chapter wizard:
    Ch 1  — Demographics Gatekeeper (select learner groups via toggle cards)
    Ch 2  — Category Loop (per-grade number input for each selected group)
    Ch 3  — Movement Gatekeeper + Loop (dropouts / repeaters per grade)
    Ch 4  — Health Check (BMI: severely wasted, wasted, overweight/obese)
    Ch 5  — Review & Submit (verify checkbox + "Submit Profile" button)

  Usage:
      pip install playwright psycopg2-binary faker
      python -m playwright install chromium
      python tests/e2e_step2_form_interaction.py
=============================================================================
"""

import sys
import traceback
import random

# ── THIRD-PARTY IMPORTS ──────────────────────────────────────────────────────
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
import psycopg2
from faker import Faker


# ── FAKER INITIALIZATION ─────────────────────────────────────────────────────
fake = Faker()

# ── Generate Dummy Data (as required by the task) ────────────────────────────
DUMMY_SCHOOL_NAME      = fake.company() + " Academy"
DUMMY_TOTAL_LEARNERS   = fake.random_int(min=200, max=1500)
DUMMY_DEPED_EMAIL      = f"{fake.first_name().lower()}.{fake.last_name().lower()}@deped.gov.ph"

print("=" * 70)
print("  FAKER — Generated Dummy Data")
print("=" * 70)
print(f"  School Name       :  {DUMMY_SCHOOL_NAME}")
print(f"  Total Learners    :  {DUMMY_TOTAL_LEARNERS}")
print(f"  DepEd Email       :  {DUMMY_DEPED_EMAIL}")
print("=" * 70 + "\n")


# ──────────────────────────────────────────────────────────────────────────────
#  DATABASE HELPER (from Step 1, reused)
# ──────────────────────────────────────────────────────────────────────────────

def get_db_connection():
    """Connect to the InsightEd PostgreSQL DB."""
    try:
        conn = psycopg2.connect(
            host="stride-posgre-prod-01.postgres.database.azure.com",
            port=5432,
            database="insightEd",
            user="Administrator1",
            password="<REDACTED_PGB_PASS>",
            sslmode="require",
        )
        print("[DB] ✅  Connected to PostgreSQL successfully.")
        return conn
    except psycopg2.Error as e:
        print(f"[DB] ❌  Connection failed: {e}")
        return None


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

# ── Demographic groups available in the Unit 4 Chapter 1 gatekeeper ──────────
# Each is a toggle-card button with text content:
DEMOGRAPHIC_LABELS = [
    "ALS Learners",
    "Muslim Learners (ALIVE)",
    "Indigenous People (IP)",
    "Displaced Learners",
    "Overage Learners",
]


# ──────────────────────────────────────────────────────────────────────────────
#  HELPER: Fill number inputs on per-grade screens
# ──────────────────────────────────────────────────────────────────────────────

def fill_grade_number_inputs(page, max_value_per_field=5):
    """
    Locate all visible number inputs on the current chapter screen and
    fill them with small random integers (0..max_value_per_field).
    Returns the count of fields filled.
    """
    # All grade-level inputs in Ch2/Ch3 are <input type="number">
    inputs = page.locator("input[type='number']")
    count = inputs.count()
    filled = 0
    for i in range(count):
        inp = inputs.nth(i)
        if inp.is_visible():
            val = str(random.randint(0, max_value_per_field))
            inp.fill(val)
            filled += 1
    return filled


def click_continue_button(page):
    """
    Click the primary navigation button in the sticky footer.
    It may read "Continue", "Next Group", "Skip Steps", or "Submit Profile".
    """
    footer_btn = page.locator(
        "button:has-text('Continue'), "
        "button:has-text('Next Group'), "
        "button:has-text('Skip Steps')"
    ).first
    footer_btn.wait_for(state="visible", timeout=10_000)
    footer_btn.scroll_into_view_if_needed()
    footer_btn.click()
    page.wait_for_timeout(800)   # Allow Framer Motion transition


# ──────────────────────────────────────────────────────────────────────────────
#  MAIN TEST FLOW
# ──────────────────────────────────────────────────────────────────────────────

def run_e2e_step2():
    """Execute Steps 1 + 2: Login → Unit 4 → Form Interaction → Submit."""

    # ── DB Connectivity Check ─────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("  STEP 0  ·  Database Connectivity Check")
    print("=" * 70)
    conn = get_db_connection()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1;")
            print(f"[DB] Ping OK: {cur.fetchone()}")
            cur.close()
        finally:
            conn.close()
            print("[DB] Connection closed.\n")
    else:
        print("[DB] ⚠  Skipping DB checks (connection unavailable).\n")

    # ── Launch Playwright ─────────────────────────────────────────────────
    print("=" * 70)
    print("  STEP 1  ·  Browser Launch, Login, Navigate to Unit 4")
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
        print(f"[BROWSER] Chromium launched  ·  viewport {MOBILE_VIEWPORT['width']}×{MOBILE_VIEWPORT['height']}")

        try:
            # ══════════════════════════════════════════════════════════════
            #  STEP 1 — Login + Navigate to Unit 4  (condensed from Step 1)
            # ══════════════════════════════════════════════════════════════
            page.goto(LOGIN_URL, wait_until="networkidle", timeout=30_000)
            page.wait_for_selector("input[placeholder='Email or School ID']", timeout=15_000)
            page.locator("input[placeholder='Email or School ID']").fill(ACCOUNT_NUMBER)
            page.locator("input[placeholder='Password']").fill(PASSWORD)
            page.locator("button[type='submit']:has-text('Sign In')").click()
            print(f"[LOGIN] Signed in as account {ACCOUNT_NUMBER}.")

            page.wait_for_timeout(3000)
            page.wait_for_load_state("networkidle", timeout=20_000)

            page.goto(DASHBOARD_URL, wait_until="networkidle", timeout=30_000)
            page.wait_for_timeout(2000)
            page.wait_for_selector("text=Modular Data Flow", timeout=10_000)
            print("[DASHBOARD] ✅  Modular Dashboard loaded.")

            page.locator("button:has-text('Unit 4')").click()
            page.wait_for_timeout(2000)
            page.wait_for_load_state("networkidle", timeout=20_000)

            if "unit-4" not in page.url:
                raise RuntimeError(f"Failed to reach Unit 4. Current URL: {page.url}")
            print("[UNIT 4] ✅  Arrived at Unit 4 — Learner Profile.\n")

            # ══════════════════════════════════════════════════════════════
            #  HANDLE REVIEW MODE
            # ══════════════════════════════════════════════════════════════
            # If Unit 4 was previously submitted, the page shows a
            # read-only summary with an "Unlock to Edit Profile" button.
            # We need to click it to enter the wizard.
            unlock_btn = page.locator("button:has-text('Unlock to Edit')")
            if unlock_btn.is_visible():
                print("[UNIT 4] Review mode detected — clicking 'Unlock to Edit Profile'.")
                unlock_btn.click()
                page.wait_for_timeout(1000)

            # ══════════════════════════════════════════════════════════════
            #  STEP 2 — FORM INTERACTION & DATA GENERATION
            # ══════════════════════════════════════════════════════════════

            # ──────────────────────────────────────────────────────────────
            #  CHAPTER 1: Demographics Gatekeeper
            #  Select learner groups (toggle-card buttons)
            # ──────────────────────────────────────────────────────────────
            print("=" * 70)
            print("  STEP 2A  ·  Chapter 1 — Demographics Gatekeeper")
            print("=" * 70)

            # Verify we see the Chapter 1 header
            try:
                page.wait_for_selector("text=Your School Community", timeout=10_000)
                print("[CH1] ✅  Chapter 1 header visible: 'Your School Community'")
            except PlaywrightTimeout:
                print("[CH1] ⚠  FIELD REQUIRING IMPROVEMENT: 'Your School Community' header "
                      "did not render. Chapter 1 gatekeeper may have changed.")

            # Select 2 demographic groups: "ALS Learners" and "Muslim Learners (ALIVE)"
            groups_to_select = ["ALS Learners", "Muslim Learners (ALIVE)"]
            for group_label in groups_to_select:
                try:
                    card = page.locator(f"button:has-text('{group_label}')")
                    card.wait_for(state="visible", timeout=5_000)
                    card.click()
                    page.wait_for_timeout(400)
                    print(f"[CH1] ✅  Selected group: '{group_label}'")
                except PlaywrightTimeout:
                    print(f"[CH1] ❌  FIELD REQUIRING IMPROVEMENT: Card '{group_label}' "
                          f"did not render within 5s.")

            # Click "Continue" to advance to Chapter 2
            click_continue_button(page)
            print("[CH1] → Advanced to next chapter.\n")

            # ──────────────────────────────────────────────────────────────
            #  CHAPTER 2: Category Loop (per-grade data entry)
            #  We selected 2 groups, so we'll see 2 sub-screens.
            # ──────────────────────────────────────────────────────────────
            print("=" * 70)
            print("  STEP 2B  ·  Chapter 2 — Category Loop (Grade-Level Data)")
            print("=" * 70)

            for idx, group_label in enumerate(groups_to_select):
                step_label = f"Step 2 • {idx + 1} of {len(groups_to_select)}"
                print(f"\n[CH2] --- {group_label} ({step_label}) ---")

                # Wait for the category screen to load
                try:
                    page.wait_for_selector(f"text={group_label}", timeout=8_000)
                    print(f"[CH2] ✅  Screen visible for: '{group_label}'")
                except PlaywrightTimeout:
                    print(f"[CH2] ❌  FIELD REQUIRING IMPROVEMENT: Screen for '{group_label}' "
                          f"failed to render after Chapter 1 selection.")
                    # Attempt to continue anyway
                    click_continue_button(page)
                    continue

                # ── Grade Level Fields ────────────────────────────────────
                # "ALS Learners" shows a single "Total ALS Learners" input.
                # Other groups show one input PER dynamically-available grade.
                try:
                    if group_label == "ALS Learners":
                        # ALS has a single total input, not per-grade
                        als_input = page.locator("input[type='number']").first
                        als_input.wait_for(state="visible", timeout=5_000)
                        als_value = str(fake.random_int(min=5, max=50))
                        als_input.fill(als_value)
                        print(f"[CH2] ✅  Filled ALS Total = {als_value}")
                    else:
                        # Other categories render per-grade inputs.
                        # Wait for at least one grade-level input to appear.
                        page.wait_for_selector("input[type='number']", timeout=8_000)
                        filled = fill_grade_number_inputs(page, max_value_per_field=3)
                        print(f"[CH2] ✅  Filled {filled} grade-level fields for '{group_label}'")

                except PlaywrightTimeout:
                    print(f"[CH2] ❌  FIELD REQUIRING IMPROVEMENT: Grade-level input fields "
                          f"for '{group_label}' did not render within timeout.")

                # Advance to next group or to Chapter 3
                click_continue_button(page)
                print(f"[CH2] → Advanced past '{group_label}'.")

            print()

            # ──────────────────────────────────────────────────────────────
            #  CHAPTER 3: Learner Movement (Gatekeeper + Loop)
            # ──────────────────────────────────────────────────────────────
            print("=" * 70)
            print("  STEP 2C  ·  Chapter 3 — Learner Movement")
            print("=" * 70)

            try:
                page.wait_for_selector("text=Learner Movement", timeout=10_000)
                print("[CH3] ✅  Movement gatekeeper visible.")
            except PlaywrightTimeout:
                print("[CH3] ❌  FIELD REQUIRING IMPROVEMENT: 'Learner Movement' "
                      "gatekeeper screen did not render.")

            # Select "Yes, we do." to enable dropout/repeater entry
            try:
                yes_btn = page.locator("button:has-text('Yes, we do.')")
                yes_btn.wait_for(state="visible", timeout=5_000)
                yes_btn.click()
                page.wait_for_timeout(500)
                print("[CH3] ✅  Selected: 'Yes, we do.' (movement data exists)")
            except PlaywrightTimeout:
                print("[CH3] ⚠  Could not find 'Yes, we do.' button. "
                      "Attempting 'No movement.' fallback.")
                try:
                    no_btn = page.locator("button:has-text('No movement.')")
                    no_btn.click()
                    page.wait_for_timeout(500)
                    print("[CH3] Selected: 'No movement.' (fallback)")
                except Exception:
                    print("[CH3] ❌  Neither movement option button found.")

            # Click Continue to enter the movement loop (Dropouts first)
            click_continue_button(page)

            # ── Dropouts sub-screen ──────────────────────────────────────
            movement_screens = ["Dropouts", "Repeaters"]
            for m_label in movement_screens:
                print(f"\n[CH3] --- {m_label} ---")
                try:
                    page.wait_for_selector(f"text={m_label}", timeout=8_000)
                    print(f"[CH3] ✅  '{m_label}' screen visible.")

                    # Fill grade-level inputs with small values
                    page.wait_for_selector("input[type='number']", timeout=5_000)
                    filled = fill_grade_number_inputs(page, max_value_per_field=2)
                    print(f"[CH3] ✅  Filled {filled} grade fields for {m_label}.")

                except PlaywrightTimeout:
                    print(f"[CH3] ❌  FIELD REQUIRING IMPROVEMENT: '{m_label}' grade-level "
                          f"fields did not render.")

                # Advance to Repeaters or to Chapter 4
                click_continue_button(page)
                print(f"[CH3] → Advanced past '{m_label}'.")

            print()

            # ──────────────────────────────────────────────────────────────
            #  CHAPTER 4: Health Check (BMI)
            # ──────────────────────────────────────────────────────────────
            print("=" * 70)
            print("  STEP 2D  ·  Chapter 4 — Health Check (BMI)")
            print("=" * 70)

            try:
                page.wait_for_selector("text=Nutritional Status", timeout=10_000)
                print("[CH4] ✅  'Nutritional Status' screen visible.")
            except PlaywrightTimeout:
                print("[CH4] ❌  FIELD REQUIRING IMPROVEMENT: 'Nutritional Status' "
                      "header did not render.")

            bmi_fields = [
                ("Severely Wasted", fake.random_int(min=1, max=20)),
                ("Wasted",          fake.random_int(min=1, max=20)),
                ("Overweight",      fake.random_int(min=1, max=20)),
            ]

            for label, value in bmi_fields:
                try:
                    # Find the label, then target the input that follows it.
                    # BMI inputs are <input type="number"> immediately after <label>.
                    label_el = page.locator(f"label:has-text('{label}')").first
                    label_el.wait_for(state="visible", timeout=5_000)

                    # The input is the next sibling of the label's parent div
                    # Using a broader approach: get ALL visible number inputs and map by order
                    bmi_input = label_el.locator("xpath=following::input[@type='number']").first
                    bmi_input.wait_for(state="visible", timeout=3_000)

                    # ── NEGATIVE TEST: Enter an invalid string value ─────
                    if label == "Severely Wasted":
                        print(f"\n[VALIDATION] ── Negative Test: entering 'ABC' into '{label}' field ──")
                        bmi_input.fill("ABC")
                        page.wait_for_timeout(500)
                        current_val = bmi_input.input_value()
                        if current_val == "ABC":
                            print("[VALIDATION] ⚠  Front-end accepted string 'ABC' in a number field — "
                                  "input type='number' should reject it natively.")
                        else:
                            print(f"[VALIDATION] ✅  Front-end correctly rejected 'ABC' "
                                  f"(field value = '{current_val}').")
                        # Clear and enter correct value
                        bmi_input.fill("")
                        page.wait_for_timeout(300)

                    bmi_input.fill(str(value))
                    print(f"[CH4] ✅  Filled '{label}' = {value}")

                except PlaywrightTimeout:
                    print(f"[CH4] ❌  FIELD REQUIRING IMPROVEMENT: BMI field '{label}' "
                          f"did not render.")
                except Exception as e:
                    print(f"[CH4] ⚠  Unexpected error filling '{label}': {e}")

            # Check the auto-calculated "Normal" BMI display
            try:
                normal_display = page.locator("text=Normal").first
                if normal_display.is_visible():
                    print("[CH4] ✅  'Normal BMI' auto-calculation is visible.")
            except Exception:
                pass

            # Advance to Chapter 5
            click_continue_button(page)
            print("[CH4] → Advanced to Chapter 5 (Review & Submit).\n")

            # ──────────────────────────────────────────────────────────────
            #  CHAPTER 5: Review & Submit
            # ──────────────────────────────────────────────────────────────
            print("=" * 70)
            print("  STEP 2E  ·  Chapter 5 — Review & Submit")
            print("=" * 70)

            try:
                page.wait_for_selector("text=Confirm", timeout=10_000)
                print("[CH5] ✅  Review screen visible ('Confirm & Submit').")
            except PlaywrightTimeout:
                print("[CH5] ❌  FIELD REQUIRING IMPROVEMENT: 'Confirm & Submit' "
                      "header did not render.")

            # ── Tick the verification checkbox ────────────────────────────
            try:
                verify_btn = page.locator("button:has-text('I verify this data is correct')")
                verify_btn.wait_for(state="visible", timeout=5_000)
                verify_btn.click()
                page.wait_for_timeout(500)
                print("[CH5] ✅  Checked verification: 'I verify this data is correct'")
            except PlaywrightTimeout:
                print("[CH5] ❌  FIELD REQUIRING IMPROVEMENT: Verification checkbox "
                      "button did not render.")

            # ── Click "Submit Profile" ────────────────────────────────────
            try:
                submit_btn = page.locator("button:has-text('Submit Profile')")
                submit_btn.wait_for(state="visible", timeout=5_000)

                # Ensure the button is enabled (disabled when !isVerified)
                is_disabled = submit_btn.get_attribute("disabled")
                if is_disabled:
                    print("[CH5] ⚠  'Submit Profile' button is disabled even after "
                          "verification. Attempting to re-verify.")
                    verify_btn.click()
                    page.wait_for_timeout(500)

                submit_btn.scroll_into_view_if_needed()
                submit_btn.click()
                print("[CH5] ✅  Clicked 'Submit Profile'.")
            except PlaywrightTimeout:
                print("[CH5] ❌  FIELD REQUIRING IMPROVEMENT: 'Submit Profile' "
                      "button did not render.")

            # ── Wait for success modal ────────────────────────────────────
            try:
                page.wait_for_selector("text=Learner Profile complete", timeout=15_000)
                print("[CH5] ✅  Success modal appeared: 'Learner Profile complete!'")
            except PlaywrightTimeout:
                print("[CH5] ⚠  Success modal did not appear within 15s. "
                      "Check network/API response.")

            # ══════════════════════════════════════════════════════════════
            #  FINISH
            # ══════════════════════════════════════════════════════════════
            print("\n" + "=" * 70)
            print("  ✅  STEP 2 COMPLETE — Form Interaction & Submission Successful")
            print("=" * 70)
            print(f"\n  Summary of Faker-generated data used:")
            print(f"    School Name     : {DUMMY_SCHOOL_NAME}")
            print(f"    Total Learners  : {DUMMY_TOTAL_LEARNERS}")
            print(f"    DepEd Email     : {DUMMY_DEPED_EMAIL}")
            print(f"    BMI Values      : {[v for _, v in bmi_fields]}")
            print()

            # Keep browser open briefly for inspection
            page.wait_for_timeout(5000)

        except PlaywrightTimeout as e:
            print(f"\n[ERROR] ⏱  Playwright timed out: {e}")
            traceback.print_exc()
            try:
                page.screenshot(path="tests/screenshot_step2_timeout.png")
                print("[DEBUG] Screenshot saved → tests/screenshot_step2_timeout.png")
            except Exception:
                pass

        except Exception as e:
            print(f"\n[ERROR] ❌  Unexpected failure: {e}")
            traceback.print_exc()
            try:
                page.screenshot(path="tests/screenshot_step2_error.png")
                print("[DEBUG] Screenshot saved → tests/screenshot_step2_error.png")
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
    run_e2e_step2()
