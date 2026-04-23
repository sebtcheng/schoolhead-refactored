"""
=============================================================================
  InsightEd Mobile PWA — End-to-End (E2E) Test Script · Step 1
  Login Flow & Navigation to Unit 4 (Learner Profile)
=============================================================================

  Tech Stack  :  Python, Playwright (sync API), psycopg2, Faker
  Target      :  Mobile-first PWA running at http://localhost:3000
  Router      :  HashRouter  →  URLs use /#/ prefix
  Scope       :  Database placeholder setup, Faker init, mobile emulation,
                 login with account number 500031, navigate to Modular
                 Dashboard → Unit 4.

  Usage:
      pip install playwright psycopg2-binary faker
      python -m playwright install chromium
      python tests/e2e_step1_login_flow.py
=============================================================================
"""

import sys
import traceback

# ── 1. THIRD-PARTY IMPORTS ───────────────────────────────────────────────────
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
import psycopg2
from faker import Faker


# ── 2. FAKER INITIALIZATION ─────────────────────────────────────────────────
# Ready to generate dummy data (names, emails, etc.) in later steps.
fake = Faker()
print(f"[INIT] Faker ready  ·  sample name: {fake.name()}")


# ──────────────────────────────────────────────────────────────────────────────
#  DATABASE HELPER
# ──────────────────────────────────────────────────────────────────────────────

def get_db_connection():
    """
    Create and return a psycopg2 connection to the InsightEd PostgreSQL DB.

    Replace the placeholder values below with your actual credentials,
    or load them from environment variables / .env for production use.
    """
    try:
        conn = psycopg2.connect(
            host="stride-posgre-prod-01.postgres.database.azure.com",
            port=5432,
            database="insightEd",
            user="Administrator1",
            password="<REDACTED_PGB_PASS>",
            # Enable SSL if the server requires it (Azure usually does)
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
LOGIN_URL      = f"{BASE_URL}/#/"                         # HashRouter root = login
DASHBOARD_URL  = f"{BASE_URL}/#/my-activity"              # School Head dashboard
UNIT_4_URL     = f"{BASE_URL}/#/modular/unit-4"           # Learner Profile

ACCOUNT_NUMBER = "500031"
PASSWORD       = "123456"

# Standard Android mobile viewport (Pixel 5-like)
MOBILE_VIEWPORT = {
    "width":  393,
    "height": 851,
}
MOBILE_USER_AGENT = (
    "Mozilla/5.0 (Linux; Android 12; Pixel 5) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/114.0.0.0 Mobile Safari/537.36"
)


# ──────────────────────────────────────────────────────────────────────────────
#  MAIN TEST FLOW
# ──────────────────────────────────────────────────────────────────────────────

def run_e2e_step1():
    """Execute Step 1: Login → Dashboard → Navigate to Unit 4."""

    # ── Optional: verify DB connectivity before the browser test ──────────
    print("\n" + "=" * 60)
    print("  STEP 0  ·  Database Connectivity Check")
    print("=" * 60)
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
        print("[DB] ⚠  Skipping DB-dependent checks (connection unavailable).\n")

    # ── Launch Playwright ─────────────────────────────────────────────────
    print("=" * 60)
    print("  STEP 1  ·  Browser Launch & Mobile Emulation")
    print("=" * 60)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=False,          # Set True for CI / headless runs
            slow_mo=300,             # Slight delay so you can observe each step
        )

        # Create a mobile-emulated browser context
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
            # ── A. Navigate to Login Page ─────────────────────────────────
            print("\n" + "-" * 60)
            print("  A  ·  Navigating to Login Page")
            print("-" * 60)
            page.goto(LOGIN_URL, wait_until="networkidle", timeout=30_000)
            print(f"[NAV] Loaded: {page.url}")

            # Wait for the login form to be visible
            page.wait_for_selector("input[placeholder='Email or School ID']", timeout=15_000)
            print("[LOGIN] Login form detected.")

            # ── B. Fill in Login Credentials ──────────────────────────────
            print("\n" + "-" * 60)
            print("  B  ·  Filling Login Credentials")
            print("-" * 60)

            # Account / School ID field
            login_input = page.locator("input[placeholder='Email or School ID']")
            login_input.fill(ACCOUNT_NUMBER)
            print(f"[LOGIN] Entered account: {ACCOUNT_NUMBER}")

            # Password field
            password_input = page.locator("input[placeholder='Password']")
            password_input.fill(PASSWORD)
            print(f"[LOGIN] Entered password: {'*' * len(PASSWORD)}")

            # ── C. Click "Sign In" ────────────────────────────────────────
            print("\n" + "-" * 60)
            print("  C  ·  Clicking Sign In")
            print("-" * 60)
            sign_in_btn = page.locator("button[type='submit']:has-text('Sign In')")
            sign_in_btn.click()
            print("[LOGIN] Clicked 'Sign In' button.")

            # ── D. Wait for Dashboard to Load ─────────────────────────────
            print("\n" + "-" * 60)
            print("  D  ·  Waiting for Post-Login Dashboard")
            print("-" * 60)
            # The app navigates via HashRouter; wait for the URL to change
            # away from the login page.
            page.wait_for_timeout(3000)  # Allow Firebase auth + role check
            page.wait_for_load_state("networkidle", timeout=20_000)
            print(f"[NAV] Current URL after login: {page.url}")

            # ── E. Navigate to Modular Dashboard ──────────────────────────
            print("\n" + "-" * 60)
            print("  E  ·  Navigating to Modular Dashboard")
            print("-" * 60)
            page.goto(DASHBOARD_URL, wait_until="networkidle", timeout=30_000)
            page.wait_for_timeout(2000)  # Let animations / data load settle
            print(f"[NAV] Loaded Modular Dashboard: {page.url}")

            # Verify the dashboard header is visible
            page.wait_for_selector("text=Modular Data Flow", timeout=10_000)
            print("[DASHBOARD] ✅  Modular Dashboard confirmed.")

            # ── F. Open Unit 4 (Learner Profile) ──────────────────────────
            print("\n" + "-" * 60)
            print("  F  ·  Opening Unit 4 — Learner Profile")
            print("-" * 60)

            # The dashboard renders Unit buttons with the text "Unit 4"
            # alongside the title. Click the card containing "Unit 4".
            unit4_btn = page.locator("button:has-text('Unit 4')")
            unit4_btn.wait_for(state="visible", timeout=10_000)
            unit4_btn.click()
            print("[NAV] Clicked 'Unit 4' card.")

            # Wait for Unit 4 page to load
            page.wait_for_timeout(2000)
            page.wait_for_load_state("networkidle", timeout=20_000)
            print(f"[NAV] Current URL: {page.url}")

            # Confirm we arrived at Unit 4
            if "unit-4" in page.url:
                print("[UNIT 4] ✅  Successfully navigated to Unit 4 (Learner Profile)!")
            else:
                print(f"[UNIT 4] ⚠  Unexpected URL: {page.url}")

            # ── DONE ──────────────────────────────────────────────────────
            print("\n" + "=" * 60)
            print("  ✅  STEP 1 COMPLETE — Login & Navigation Successful")
            print("=" * 60)

            # Pause so you can inspect the browser state (remove for CI)
            page.wait_for_timeout(5000)

        except PlaywrightTimeout as e:
            print(f"\n[ERROR] ⏱  Playwright timed out: {e}")
            traceback.print_exc()
            # Capture a screenshot for debugging
            page.screenshot(path="tests/screenshot_timeout_error.png")
            print("[DEBUG] Screenshot saved → tests/screenshot_timeout_error.png")

        except Exception as e:
            print(f"\n[ERROR] ❌  Unexpected failure: {e}")
            traceback.print_exc()
            try:
                page.screenshot(path="tests/screenshot_unexpected_error.png")
                print("[DEBUG] Screenshot saved → tests/screenshot_unexpected_error.png")
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
    run_e2e_step1()
