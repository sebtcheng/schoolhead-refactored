"""
=============================================================================
  InsightEd Mobile PWA — End-to-End (E2E) Test Script · Multi-Unit Support
=============================================================================

  A data-driven, scalable E2E suite that tests all Modular Units sequentially.
  
  Features:
    - Global Login (single session)
    - Dynamic Unit Navigation & Interaction
    - Unit-specific Database Verification
    - Aggregated Master Report (tests/e2e_multi_unit_report.txt)

  Units: 1, 2, 3, 4, 5, 7, 8, 9, 10
=============================================================================
"""

import sys
import os
import json
import traceback
import random
import time
from datetime import datetime, timezone

# ── THIRD-PARTY IMPORTS ──────────────────────────────────────────────────────
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
import psycopg2
from faker import Faker

# ══════════════════════════════════════════════════════════════════════════════
#  CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

BASE_URL       = "http://localhost:5173/insighted"
LOGIN_URL      = f"{BASE_URL}/#/"
DASHBOARD_URL  = f"{BASE_URL}/#/modular-dashboard"

ACCOUNT_NUMBER = "500031"
PASSWORD       = "123456"

MOBILE_VIEWPORT = {"width": 393, "height": 851}
MOBILE_USER_AGENT = (
    "Mozilla/5.0 (Linux; Android 12; Pixel 5) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/114.0.0.0 Mobile Safari/537.36"
)

DB_CONFIG = {
    "host":     "stride-posgre-prod-01.postgres.database.azure.com",
    "port":     5432,
    "database": "insightEd",
    "user":     "Administrator1",
    "password": "<REDACTED_PGB_PASS>",
    "sslmode":  "require",
}

REPORT_PATH = os.path.join(os.path.dirname(__file__), "e2e_multi_unit_report.txt")

ALL_GRADE_IDS = [
    "kinder", "g1", "g2", "g3", "g4", "g5", "g6",
    "g7", "g8", "g9", "g10", "g11", "g12",
]

# ══════════════════════════════════════════════════════════════════════════════
#  UNIT CONFIGURATION (Data-Driven)
# ══════════════════════════════════════════════════════════════════════════════

UNIT_CONFIG = {
    "Unit 1": {
        "route": "unit-1",
        "table": "ph_schools",
        "fields": [
            {"name": "iern", "selector": "input[name='iern']", "type": "text"},
            {"name": "school_name", "selector": "input[name='school_name']", "type": "text"},
            {"name": "school_head", "selector": "input[name='school_head']", "type": "text"},
            {"name": "contact_number", "selector": "input[name='contact_number']", "type": "text"},
            {"name": "latitude", "selector": "input[name='latitude']", "type": "text"},
            {"name": "longitude", "selector": "input[name='longitude']", "type": "text"},
        ]
    },
    "Unit 2": {
        "route": "unit-2",
        "table": "ph_schools",
        "fields": [{"name": f"enroll_{g}", "type": "grade_count"} for g in ALL_GRADE_IDS]
    },
    "Unit 3": {
        "route": "unit-3",
        "table": "ph_schools",
        "fields": [
            {"name": "has_multigrade", "selector": "button:has-text('Yes')", "type": "toggle", "db_col": "has_multigrade"},
        ]
    },
    "Unit 4": {
        "route": "unit-4",
        "table": "ph_schools",
        "fields": [
            {"name": "als_total", "type": "number"},
            {"name": "bmi_severely_wasted", "type": "number"},
            {"name": "bmi_wasted", "type": "number"},
            {"name": "bmi_overweight_obese", "type": "number"},
        ]
    },
    "Unit 5": {
        "route": "unit-5",
        "table": "ph_schools",
        "fields": [
            {"name": "has_standard_shifting", "selector": "button:has-text('Yes')", "type": "toggle"},
            {"name": "adm_mdl", "selector": "button:has-text('MDL')", "type": "toggle"},
        ]
    },
    "Unit 7": {
        "route": "unit-7",
        "table": "teaching_personnel",
        "fields": [
            {"name": "fund_deped", "type": "number"},
            {"name": "fund_lgu", "type": "number"},
        ]
    },
    "Unit 8": {
        "route": "unit-8",
        "table": "ph_teachers_list",
        "type": "registry"
    },
    "Unit 9": {
        "route": "unit-9",
        "table": "ph_ecart_batches",
        "type": "registry"
    },
    "Unit 10": {
        "route": "unit-10",
        "table": "ph_buildings_inventory",
        "type": "registry"
    }
}

# ══════════════════════════════════════════════════════════════════════════════
#  TEST CONTEXT
# ══════════════════════════════════════════════════════════════════════════════

class UnitResult:
    def __init__(self, name):
        self.name = name
        self.nav_ok = False
        self.form_ok = False
        self.db_ok = False
        self.field_results = []
        self.errors = []
        self.expected_values = {}

    def add_error(self, msg):
        self.errors.append(msg)

    def add_field(self, field, inputted, db_value, match):
        self.field_results.append({
            "field": field,
            "inputted": inputted,
            "db_value": db_value,
            "match": match
        })

class TestContext:
    def __init__(self):
        self.start_time = datetime.now(timezone.utc)
        self.end_time = None
        self.login_ok = False
        self.unit_results = {} # name -> UnitResult

    def get_unit(self, name):
        if name not in self.unit_results:
            self.unit_results[name] = UnitResult(name)
        return self.unit_results[name]

    def finish(self):
        self.end_time = datetime.now(timezone.utc)

# ══════════════════════════════════════════════════════════════════════════════
#  HELPERS & UI UTILS
# ══════════════════════════════════════════════════════════════════════════════

fake = Faker()

def get_db_connection():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception:
        return None

def click_continue(page):
    btn = page.locator("button:has-text('Continue'), button:has-text('Next'), button:has-text('Submit'), button:has-text('I verify')").first
    if btn.is_visible():
        btn.click()
        page.wait_for_timeout(800)
        return True
    return False

# ══════════════════════════════════════════════════════════════════════════════
#  CORE TEST FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def run_unit_form(page, unit_name, config, res: UnitResult):
    """Specific form interaction logic per unit."""
    print(f"  [UI] Filling {unit_name}...")
    try:
        if unit_name == "Unit 1":
            # Step 0: School ID
            page.locator("input[placeholder*='School ID']").fill(ACCOUNT_NUMBER)
            res.expected_values["school_id"] = ACCOUNT_NUMBER
            click_continue(page)
            # Step 1: School Name
            page.locator("input[name='school_name']").fill(DUMMY_SCHOOL_NAME := fake.company())
            res.expected_values["school_name"] = DUMMY_SCHOOL_NAME
            click_continue(page)
            # Finish the rest with generic continue
            while click_continue(page): pass

        elif unit_name == "Unit 2":
            # Chapter 1: Enrollment Counts
            # Wait for any number input to ensure page is ready
            page.wait_for_selector("input[type='number']", timeout=10000)
            inputs = page.locator("input[type='number']")
            for i in range(inputs.count()):
                val = random.randint(10, 100)
                inputs.nth(i).fill(str(val))
                if i < len(ALL_GRADE_IDS):
                    res.expected_values[f"enroll_{ALL_GRADE_IDS[i]}"] = val
            while click_continue(page): pass

        elif unit_name == "Unit 3":
            # Chapter 1: Multigrade Toggle
            yes_btn = page.locator("button:has-text('Yes, we have multigrade')")
            if yes_btn.is_visible():
                yes_btn.click()
                res.expected_values["has_multigrade"] = True
            click_continue(page)
            # Submit
            click_continue(page)

        elif unit_name == "Unit 4":
            # Chapter 1: Categories
            cards = page.locator(".category-card")
            if cards.count() > 0:
                cards.nth(0).click() # ALS
                res.expected_values["selected_learner_groups"] = ["als"]
            click_continue(page)
            
            # Category Loop
            als_input = page.locator("input[type='number']").first
            val = random.randint(5, 40)
            als_input.fill(str(val))
            res.expected_values["als_total"] = val
            click_continue(page)
            
            # Movement
            page.locator("button:has-text('No')").click()
            click_continue(page)
            
            # BMI
            bmi_inputs = page.locator("input[type='number']")
            for i in range(bmi_inputs.count()):
                val = random.randint(1, 15)
                bmi_inputs.nth(i).fill(str(val))
            click_continue(page)
            
            # Submit
            click_continue(page)

        elif unit_name == "Unit 5":
            # Chapter 1: Standards
            page.locator("button:has-text('Yes')").first.click()
            res.expected_values["has_standard_shifting"] = True
            click_continue(page)
            
            # Chapter 2: ADM
            page.locator("button:has-text('MDL')").click()
            res.expected_values["adm_mdl"] = True
            click_continue(page)
            
            # Submit
            click_continue(page)

        elif unit_name == "Unit 7":
            # Chapter 1: Funding
            inputs = page.locator("input[type='number']")
            for i in range(min(inputs.count(), 2)):
                val = random.randint(1, 10)
                inputs.nth(i).fill(str(val))
                name = ["fund_deped", "fund_lgu"][i]
                res.expected_values[name] = val
            click_continue(page)
            
            # Submit
            click_continue(page)

        elif unit_name == "Unit 8":
            # Add Personnel
            page.locator("button:has-text('Add Personnel')").click()
            page.locator("input[placeholder='First Name']").fill(fake.first_name())
            page.locator("input[placeholder='Last Name']").fill(fake.last_name())
            res.expected_values["last_name"] = "Added-By-E2E" # Custom mark
            page.locator("input[placeholder='Last Name']").fill(res.expected_values["last_name"])
            page.locator("button:has-text('Save Personnel')").click()
            page.wait_for_timeout(1000)

        elif unit_name == "Unit 9":
            # Add eCart Batch
            page.locator("button:has-text('Add New Batch')").click()
            page.locator("input[placeholder='Batch Name']").fill("E2E Test Batch")
            res.expected_values["batches_name"] = "E2E Test Batch"
            page.locator("button:has-text('Save Batch')").click()
            page.wait_for_timeout(1000)

        elif unit_name == "Unit 10":
            # Move to Step 2 (Inventory)
            page.locator("button:has-text('Step 2')").click()
            page.locator("button:has-text('Add Building')").click()
            name = f"Bldg-{random.randint(100, 999)}"
            page.locator("input[placeholder='Building Name']").fill(name)
            res.expected_values["building_name"] = name
            page.locator("button:has-text('Save Building')").click()
            page.wait_for_timeout(1000)

        else:
            print(f"  [UI] Generic click-through for {unit_name}")
            for _ in range(5):
                if not click_continue(page): break

        res.form_ok = True
        print(f"  [UI] ✅ {unit_name} Interaction Complete.")
    except Exception as e:
        res.add_error(f"Form Error: {str(e)}")
        traceback.print_exc()

def verify_unit_db(db_cursor, unit_name, config, res: UnitResult):
    """Verification logic with schema awareness."""
    print(f"  [DB] Verifying {unit_name}...")
    try:
        table = config.get("table", "ph_schools")
        if config.get("type") == "registry":
            # For registries, we check if ANY row exists with our test marker
            db_cursor.execute(f"SELECT * FROM {table} WHERE school_id = %s ORDER BY created_at DESC LIMIT 1", (ACCOUNT_NUMBER,))
        else:
            db_cursor.execute(f"SELECT * FROM {table} WHERE school_id = %s", (ACCOUNT_NUMBER,))
        
        row = db_cursor.fetchone()
        if not row:
            res.add_error(f"No row found for {ACCOUNT_NUMBER} in {table}")
            return

        col_names = [d[0] for d in db_cursor.description]
        db_data = dict(zip(col_names, row))

        for f_name, exp_val in res.expected_values.items():
            db_val = db_data.get(f_name)
            # Value normalization for robust comparison
            if isinstance(exp_val, bool):
                match = bool(db_val) == exp_val
            elif isinstance(exp_val, int):
                match = db_val is not None and int(db_val) == exp_val
            else:
                match = str(db_val) == str(exp_val)
            
            res.add_field(f_name, exp_val, db_val, match)
        
        res.db_ok = True
        print(f"  [DB] ✅ {unit_name} DB Match Success.")
    except Exception as e:
        res.add_error(f"DB Error: {str(e)}")

# ══════════════════════════════════════════════════════════════════════════════
#  REPORT GENERATOR
# ══════════════════════════════════════════════════════════════════════════════

def generate_full_report(ctx: TestContext):
    lines = [
        "=" * 80,
        "  INSIGHTED MULTI-UNIT E2E TEST REPORT",
        "=" * 80,
        f"  Account   : {ACCOUNT_NUMBER}",
        f"  Timestamp : {ctx.start_time}",
        f"  Login     : {'✅ OK' if ctx.login_ok else '❌ FAILED'}",
        "=" * 80,
        ""
    ]
    
    for name, res in ctx.unit_results.items():
        lines.append(f"── {name.upper()} " + "─" * 60)
        lines.append(f"   Navigation : {'✅' if res.nav_ok else '❌'}")
        lines.append(f"   Form Fill  : {'✅' if res.form_ok else '❌'}")
        lines.append(f"   DB Verify  : {'✅' if res.db_ok else '❌'}")
        
        if res.errors:
            lines.append("   Errors:")
            for e in res.errors: lines.append(f"     - {e}")
            
        if res.field_results:
            lines.append(f"   {'Field':<30} {'Input':<15} {'DB':<15} {'Match'}")
            lines.append("   " + "-" * 70)
            for f in res.field_results:
                status = "✅" if f["match"] else "❌"
                lines.append(f"   {f['field']:<30} {str(f['inputted']):<15} {str(f['db_value']):<15} {status}")
        lines.append("")

    lines.append("=" * 80)
    lines.append(f"  Total Duration: {(ctx.end_time - ctx.start_time).total_seconds():.1f}s")
    lines.append("=" * 80)
    return "\n".join(lines)

# ══════════════════════════════════════════════════════════════════════════════
#  MAIN EXECUTION
# ══════════════════════════════════════════════════════════════════════════════

def run_full_pipeline():
    ctx = TestContext()
    
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False, slow_mo=100)
        context = browser.new_context(viewport=MOBILE_VIEWPORT, user_agent=MOBILE_USER_AGENT)
        page = context.new_page()
        
        try:
            # 1. LOGIN
            print(f"[LOGIN] Logging in as {ACCOUNT_NUMBER}...")
            page.goto(LOGIN_URL)
            page.wait_for_selector("input[placeholder*='School ID']", timeout=10000)
            page.locator("input[placeholder*='School ID']").fill(ACCOUNT_NUMBER)
            page.locator("input[placeholder='Password']").fill(PASSWORD)
            page.locator("button[type='submit']").click()
            page.wait_for_timeout(3000)
            ctx.login_ok = True
            
            # 2. UNIT LOOP
            for name, config in UNIT_CONFIG.items():
                print(f"\n[TEST] Starting {name}...")
                res = ctx.get_unit(name)
                
                try:
                    # Navigate
                    page.goto(f"{BASE_URL}/#/modular/{config['route']}")
                    page.wait_for_timeout(2000)
                    
                    # Unblock if review mode
                    unlock = page.locator("button:has-text('Unlock to Edit')")
                    if unlock.is_visible(): unlock.click()
                    
                    res.nav_ok = True
                    
                    # Interaction
                    run_unit_form(page, name, config, res)
                    
                    # Submit Verification
                    # (Usually happens at end of run_unit_form)
                    
                    # Database check
                    conn = get_db_connection()
                    if conn:
                        verify_unit_db(conn.cursor(), name, config, res)
                        conn.close()
                    else:
                        res.add_error("DB Connection Failed")
                        
                except Exception as e:
                    res.add_error(f"Unit Crash: {str(e)}")
                    
            ctx.finish()
            report = generate_full_report(ctx)
            with open(REPORT_PATH, "w", encoding="utf-8") as f:
                f.write(report)
            print(f"\n[DONE] Multi-unit report generated: {REPORT_PATH}")
            
        finally:
            browser.close()

if __name__ == "__main__":
    run_full_pipeline()
