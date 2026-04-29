/**
 * PrintableExportGenerator.js
 * Generates a printer-optimized HTML report for School Data.
 */

export const generateSchoolReportHTML = (data, unit7Master, unit8Terrain, userRole) => {
  const { schoolInfo = {}, progress = {} } = data;
  const s = data.data || {}; // Main ph_schools row

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    
    :root {
      --primary: #004A99;
      --secondary: #EAB308;
      --text-dark: #1E293B;
      --text-muted: #64748B;
      --border: #E2E8F0;
      --bg-light: #F8FAFC;
    }

    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: var(--text-dark);
      line-height: 1.5;
      margin: 0;
      padding: 0;
      background: white;
    }

    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    .header {
      border-bottom: 2px solid var(--primary);
      padding-bottom: 20px;
      margin-bottom: 30px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .header-left h1 {
      margin: 0;
      color: var(--primary);
      font-size: 28px;
    }

    .header-left p {
      margin: 5px 0 0;
      color: var(--text-muted);
      font-size: 14px;
    }

    .header-right {
      text-align: right;
    }

    .header-right .badge {
      background: var(--primary);
      color: white;
      padding: 4px 12px;
      border-radius: 99px;
      font-weight: 600;
      font-size: 12px;
    }

    section {
      margin-bottom: 35px;
      page-break-inside: avoid;
    }

    h2 {
      font-size: 18px;
      color: var(--primary);
      border-left: 4px solid var(--secondary);
      padding-left: 12px;
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
    }

    .info-box {
      background: var(--bg-light);
      padding: 12px;
      border-radius: 6px;
      border: 1px solid var(--border);
    }

    .info-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 2px;
    }

    .info-value {
      font-size: 14px;
      font-weight: 600;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 13px;
    }

    th, td {
      border: 1px solid var(--border);
      padding: 8px 12px;
      text-align: left;
    }

    th {
      background: var(--bg-light);
      font-weight: 700;
      color: var(--primary);
    }

    .text-center { text-align: center; }
    .font-bold { font-weight: 700; }

    .tag-container {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 5px;
    }

    .tag {
      font-size: 10px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .tag-orange { background: #ffedd5; color: #9a3412; border: 1px solid #fed7aa; }
    .tag-red { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .tag-slate { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
    .tag-blue { background: #eff6ff; color: #1e40af; border: 1px solid #dbeafe; }
    .tag-rose { background: #fff1f2; color: #9f1239; border: 1px solid #fecdd3; }

    @media print {
      body { padding: 0; }
      .container { width: 100%; max-width: none; padding: 0; }
      .no-print { display: none; }
      @page {
        margin: 1.5cm;
      }
      .info-box {
        background: white !important;
        border: 1px solid #ddd !important;
      }
      th {
        background: #eee !important;
        -webkit-print-color-adjust: exact;
      }
    }
  `;

  const formatNumber = (val) => (val !== null && val !== undefined ? Number(val).toLocaleString() : '0');
  const formatText = (val) => val || '—';

  const safeParse = (val) => {
    if (!val) return null;
    if (typeof val === 'object') return val;
    try {
      return JSON.parse(val);
    } catch (e) {
      return null;
    }
  };

  const renderWashInfo = (val) => {
    const data = safeParse(val);
    if (!data) return '—';
    return `
      <div style="font-size: 13px;">
        <table style="font-size: 11px; margin-top: 5px;">
          <thead>
            <tr><th style="padding:4px;">Category</th><th style="padding:4px;" class="text-center">Total</th><th style="padding:4px;" class="text-center">Func</th></tr>
          </thead>
          <tbody>
            <tr><td>Male Seats</td><td class="text-center">${data.male_seats_total || 0}</td><td class="text-center">${data.male_seats_func || 0}</td></tr>
            <tr><td>Female Seats</td><td class="text-center">${data.female_seats_total || 0}</td><td class="text-center">${data.female_seats_func || 0}</td></tr>
            <tr><td>Common Seats</td><td class="text-center">${data.common_seats_total || 0}</td><td class="text-center">${data.common_seats_func || 0}</td></tr>
            <tr><td>PWD Seats</td><td class="text-center">${data.pwd_seats_total || 0}</td><td class="text-center">${data.pwd_seats_func || 0}</td></tr>
            <tr><td>Faucets</td><td class="text-center">${data.faucets_total || 0}</td><td class="text-center">${data.faucets_func || 0}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  };

  const renderFurnitureInfo = (val) => {
    const data = safeParse(val);
    if (!data || !data.grades) return '—';
    
    let wood = 0, plastic = 0, steel = 0, wood2 = 0, steel2 = 0;
    let w_need = 0, p_need = 0, s_need = 0, w2_need = 0, s2_need = 0;
    data.grades.forEach(g => {
      wood += (parseInt(g.armchair_wood_func) || 0);
      w_need += (parseInt(g.armchair_wood_needed) || 0);

      plastic += (parseInt(g.armchair_plastic_func) || 0);
      p_need += (parseInt(g.armchair_plastic_needed) || 0);

      steel += (parseInt(g.armchair_plastic_steel_func) || 0);
      s_need += (parseInt(g.armchair_plastic_steel_needed) || 0);

      wood2 += (parseInt(g.two_seater_wood_func) || 0);
      w2_need += (parseInt(g.two_seater_wood_needed) || 0);

      steel2 += (parseInt(g.two_seater_wood_steel_func) || 0);
      s2_need += (parseInt(g.two_seater_wood_steel_needed) || 0);
    });

    return `
      <div style="font-size: 13px;">
        <table style="font-size: 11px; margin-top: 0;">
          <thead>
            <tr><th style="padding:4px;">Type</th><th style="padding:4px;" class="text-center">Qty (Func)</th><th style="padding:4px;" class="text-center">Shortage</th></tr>
          </thead>
          <tbody>
            <tr><td>Armchair (Wood)</td><td class="text-center">${wood}</td><td class="text-center">${w_need}</td></tr>
            <tr><td>Armchair (Plastic)</td><td class="text-center">${plastic}</td><td class="text-center">${p_need}</td></tr>
            <tr><td>Armchair (P-Steel)</td><td class="text-center">${steel}</td><td class="text-center">${s_need}</td></tr>
            <tr><td>2-Seater (Wood)</td><td class="text-center">${wood2}</td><td class="text-center">${w2_need}</td></tr>
            <tr><td>2-Seater (Steel)</td><td class="text-center">${steel2}</td><td class="text-center">${s2_need}</td></tr>
          </tbody>
        </table>
        <p style="font-size: 9px; color: var(--text-muted); margin-top: 5px;">*Showing functional counts and shortages for audited levels.</p>
      </div>
    `;
  };

  const renderICTInfo = (val) => {
    const data = safeParse(val);
    if (!data) return '—';
    const items = [
      { label: 'Laptops', total: data.laptops_total, func: data.laptops_working },
      { label: 'Tablets', total: data.tablets_total, func: data.tablets_working },
      { label: 'Desktops', total: data.desktops_total, func: data.desktops_working },
      { label: 'Smart TVs', total: data.smart_tvs_total, func: data.smart_tvs_func },
      { label: 'Projectors', total: data.projectors_total, func: data.projectors_func },
      { label: 'Printers', total: data.printers_total, func: data.printers_func },
    ];
    
    return `
      <table style="font-size: 11px; margin-top: 0;">
        <thead>
          <tr><th style="padding:4px;">Device</th><th style="padding:4px;" class="text-center">Total</th><th style="padding:4px;" class="text-center">Func</th></tr>
        </thead>
        <tbody>
          ${items.map(i => `
            <tr><td>${i.label}</td><td class="text-center">${i.total || 0}</td><td class="text-center">${i.func || 0}</td></tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const renderInfrastructureUnit = (s) => {
    const general = safeParse(s.u9_general) || {};
    const wiring = safeParse(s.u9_wiring) || {};
    const final = safeParse(s.u9_final) || {};
    
    const getBadge = (val, labels = ['Yes', 'No', 'N/A'], colors = ['#059669', '#dc2626', '#64748b']) => {
      if (val === 1 || val === true || val === 'true' || val === '1') return `<span style="color: ${colors[0]}; font-weight: bold;">${labels[0]}</span>`;
      if (val === 0 || val === false || val === 'false' || val === '0') return `<span style="color: ${colors[1]}; font-weight: bold;">${labels[1]}</span>`;
      if (val === 2) return `<span style="color: ${colors[2]}; font-weight: bold;">${labels[2]}</span>`;
      return `<span style="color: ${colors[2]}; font-weight: bold;">—</span>`;
    };

    // Helper to format inventory items with fallback to flat columns
    const renderInventoryTable = () => {
      const rows = [
        { label: 'CCTV Cameras', key: 'cctv', itemsKey: 'cctv_cameras' },
        { label: 'Fire Extinguishers', key: 'fire_ext', itemsKey: 'fire_extinguishers' },
        { label: 'First Aid Kits', key: 'first_aid', itemsKey: 'first_aid_kits' },
        { label: 'Bullhorns / Megaphones', key: 'bullhorns', itemsKey: 'portable_megaphones' },
        { label: 'Portable Radios', key: 'radios', itemsKey: 'battery_radios' },
        { label: 'Flashlights', key: 'flashlight', itemsKey: 'large_flashlights' },
      ];

      const getVal = (prefix, type) => {
        // Try JSONB first
        if (final.items && final.items[prefix]) return final.items[prefix][type] || 0;
        // Fallback to flat columns
        const col = `u9_${prefix}_${type}`;
        return s[col] || 0;
      };

      const whistles = final.items?.emergency_whistles?.total || s.u9_whistles_quantity || 0;

      return `
        <table style="font-size: 11px; margin-top: 5px;">
          <thead>
            <tr><th style="padding:4px;">Safety Equipment</th><th style="padding:4px;" class="text-center">Working</th><th style="padding:4px;" class="text-center">Broken</th><th style="padding:4px;" class="text-center">Spares</th></tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${r.label}</td>
                <td class="text-center font-bold">${getVal(r.key, 'working')}</td>
                <td class="text-center">${getVal(r.key, 'broken')}</td>
                <td class="text-center">${getVal(r.key, 'spares')}</td>
              </tr>
            `).join('')}
            <tr><td>Emergency Whistles</td><td colspan="3" class="text-center font-bold">${whistles} PCS</td></tr>
          </tbody>
        </table>
      `;
    };

    return `
      <div class="grid" style="margin-bottom: 10px;">
        <div class="info-box">
          <div class="info-label">Main Power Source</div>
          <div class="info-value">
            ${general.main_power_source || safeParse(s.unit7_utilities)?.utility_electricity || safeParse(s.unit7_wash)?.power_source || '—'}
          </div>
        </div>
        <div class="info-box">
          <div class="info-label">Active Meters</div>
          <div class="info-value">${general.active_meters || 0} Meters</div>
        </div>
      </div>

      <div class="grid" style="margin-bottom: 15px;">
        <div class="info-box">
          <div class="info-label">Panel & Safety Checks</div>
          <div style="font-size: 11px; margin-top: 5px;">
            <div>Panel Access: ${getBadge(general.panel_clear)}</div>
            <div>Labeled Switches: ${getBadge(general.panel_labeled)}</div>
            <div>Locked Cabinet: ${getBadge(general.panel_locked)}</div>
          </div>
        </div>
        <div class="info-box">
          <div class="info-label">Utility & Protection Features</div>
          <div style="font-size: 11px; margin-top: 5px;">
            <div>Fire Exit Available: ${getBadge(s.u9_fire_exit_exists)}</div>
            <div>Backup Lighting: ${getBadge(s.u9_backup_light_exists)}</div>
            <div>Surge Protection: ${getBadge(s.u9_has_surge_protection)}</div>
          </div>
        </div>
      </div>

      <h3 style="font-size: 13px; color: var(--primary); margin-bottom: 5px; text-transform: uppercase;">Security & Disaster Readiness Inventory</h3>
      ${renderInventoryTable()}

      <div class="grid" style="margin-top: 15px;">
        <div class="info-box">
          <div class="info-label">Capacity & Readiness</div>
          <div style="font-size: 11px; margin-top: 5px;">
            <div>e-Classroom Load Ready: ${getBadge(s.u9_ecart_load_ready)}</div>
            <div>Wiring/Outlets Unbroken: ${getBadge(wiring.outlet_covers_unbroken)}</div>
          </div>
        </div>
        <div class="info-box">
          <div class="info-label">Auditor Remarks</div>
          <div style="font-size: 11px; font-style: italic; color: var(--text-dark); margin-top: 5px;">
            "${s.u9_remarks || final.remarks || 'No additional remarks.'}"
          </div>
        </div>
      </div>
    `;
  };

  const renderRoomsTable = (rooms) => {
    if (!rooms || rooms.length === 0) return '<p style="font-size: 11px; color: var(--text-muted); margin-top: 5px;">No room details reported.</p>';
    
    return `
      <table style="font-size: 11px; margin-top: 5px; margin-bottom: 15px; border: 1px solid #e2e8f0;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 4px 8px; color: #475569; font-size: 10px;">Room Name</th>
            <th style="padding: 4px 8px; color: #475569; font-size: 10px;" class="text-center">Sections Occupying It</th>
            <th style="padding: 4px 8px; color: #475569; font-size: 10px;" class="text-center">Seats</th>
          </tr>
        </thead>
        <tbody>
          ${rooms.map(r => `
            <tr>
              <td style="padding: 4px 8px;">${r.room_name}</td>
              <td style="padding: 4px 8px;" class="text-center">${(r.grade_level || "").replace(/;/g, ', ') || '—'}</td>
              <td style="padding: 4px 8px;" class="text-center">${r.seats || '0'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  // --- Extract Enrollment Distribution from JSONB ---
  let enrollmentDist = {};
  let calculatedTotalM = 0;
  let calculatedTotalF = 0;

  if (s.unit2_simplified_enrollment) {
    try {
      const raw = typeof s.unit2_simplified_enrollment === 'string' 
        ? JSON.parse(s.unit2_simplified_enrollment) 
        : s.unit2_simplified_enrollment;
      const list = Array.isArray(raw) ? raw : (raw.array || []);
      list.forEach(item => {
        const m = parseInt(item.male) || 0;
        const f = parseInt(item.female) || 0;
        enrollmentDist[item.grade_level] = { m, f };
        calculatedTotalM += m;
        calculatedTotalF += f;
      });
    } catch (e) {
      console.warn("Failed to parse enrollment distribution:", e);
    }
  }

  const getM = (grade) => formatNumber(enrollmentDist[grade]?.m || 0);
  const getF = (grade) => formatNumber(enrollmentDist[grade]?.f || 0);
  const getGradeTotal = (grade) => formatNumber((enrollmentDist[grade]?.m || 0) + (enrollmentDist[grade]?.f || 0));

  // --- Curricular Offering Filtering ---
  const offering = (s.curricular_offering || '').toLowerCase();
  const isApplicable = (grade) => {
    if (offering.includes('integrated') || offering.includes('combined')) return true;
    if (grade === 'kinder' && (offering.includes('kinder') || offering.includes('elem'))) return true;
    if (['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].includes(grade) && offering.includes('elem')) return true;
    if (['g7', 'g8', 'g9', 'g10'].includes(grade) && (offering.includes('jhs') || offering.includes('junior'))) return true;
    if (['g11', 'g12'].includes(grade) && (offering.includes('shs') || offering.includes('senior'))) return true;
    
    // If we have data for a grade, show it anyway to be safe
    if ((enrollmentDist[grade]?.m || 0) + (enrollmentDist[grade]?.f || 0) > 0) return true;
    return false;
  };

  // --- Calculate Latest Data Timestamp (As Of Date) ---
  const timestampCols = [
    'unit1_updated_at', 'unit2_updated_at', 'unit3_updated_at', 'unit4_updated_at', 'unit5_updated_at',
    'unit6_updated_at', 'unit7_updated_at', 'unit8_updated_at', 'unit9_updated_at',
    'verified_as_of', 'updated_at'
  ];
  let latestTimestamp = null;
  timestampCols.forEach(col => {
    if (s[col]) {
      const d = new Date(s[col]);
      if (!latestTimestamp || d > latestTimestamp) {
        latestTimestamp = d;
      }
    }
  });
  const asOfDate = latestTimestamp ? latestTimestamp.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

  // Format School Head Name combinations
  const getSchoolHead = () => {
    const { head_last_name, head_first_name, head_middle_name, school_head_lname, school_head_fname, school_head_mname, school_head } = s;
    
    // Priority 1: head_* columns (common in ph_schools)
    if (head_last_name || head_first_name) {
      return `${head_last_name || ''}, ${head_first_name || ''} ${head_middle_name || ''}`.trim().replace(/^, /, '');
    }
    
    // Priority 2: school_head_* columns
    if (school_head_lname || school_head_fname) {
      return `${school_head_lname || ''}, ${school_head_fname || ''} ${school_head_mname || ''}`.trim().replace(/^, /, '');
    }
    
    return school_head || '—';
  };

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>InsightEd Report - ${s.school_name || 'School Export'}</title>
      <style>${styles}</style>
    </head>
    <body>
      <div class="container">
        <header class="header">
          <div class="header-left">
            <h1>${s.school_name || 'School Name Not Set'}</h1>
            <p>School ID: ${s.school_id || 'N/A'} | IERN: ${s.iern || 'N/A'}</p>
            <p style="color: var(--primary); font-weight: 600; font-size: 13px; margin-top: 8px;">Data as of: ${asOfDate}</p>
          </div>
          <div class="header-right">
            <span class="badge">Official Data Export</span>
            <p style="font-size: 10px; margin-top: 8px; color: var(--text-muted);">Generated on: ${new Date().toLocaleString()}</p>
          </div>
        </header>

        <!-- UNIT 1: IDENTITY -->
        <section>
          <h2>Unit 1: School Identity & Head</h2>
          <div class="grid">
            <div class="info-box">
              <div class="info-label">Region</div>
              <div class="info-value">${formatText(s.region)}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Division</div>
              <div class="info-value">${formatText(s.division)}</div>
            </div>
            <div class="info-box">
              <div class="info-label">District</div>
              <div class="info-value">${formatText(s.district)}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Municipality</div>
              <div class="info-value">${formatText(s.municipality)}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Province</div>
              <div class="info-value">${formatText(s.province)}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Barangay</div>
              <div class="info-value">${formatText(s.barangay)}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Legislative District</div>
              <div class="info-value">${formatText(s.leg_district)}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Coordinates (Lat, Long)</div>
              <div class="info-value">${s.latitude && s.longitude ? `${s.latitude}, ${s.longitude}` : '—'}</div>
            </div>
            <div class="info-box">
              <div class="info-label">School Head</div>
              <div class="info-value">${getSchoolHead()}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Curricular Offering</div>
              <div class="info-value">${formatText(s.curricular_offering)}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Ownership Type</div>
              <div class="info-value">
                ${s.ownership === 'multiple' ? `
                  <div style="font-size: 13px; margin-top: 4px;">
                    ${(() => {
                      try {
                        const mult = Array.isArray(s.ownership_multiple) ? s.ownership_multiple : JSON.parse(s.ownership_multiple || '[]');
                        const mapping = { deped: 'DepEd-owned', lgu_owned: 'LGU-owned', privately_owned: 'Privately-owned', nga_owned: 'NGA-owned' };
                        return mult.map(m => `<span style="display:inline-block; background:#e2e8f0; padding:2px 8px; border-radius:12px; margin-right:4px; margin-bottom:4px;">${mapping[m] || m}</span>`).join('');
                      } catch(e) { return 'Multiple'; }
                    })()}
                  </div>
                ` : formatText(s.ownership)}
              </div>
            </div>
            <div class="info-box">
              <div class="info-label">Document Submitted</div>
              <div class="info-value">
                ${s.ownership === 'multiple' ? `
                  <div style="font-size: 11px; margin-top: 4px; color: var(--text-dark);">
                    ${(() => {
                      try {
                        const docs = Array.isArray(s.ownership_document_multiple) ? s.ownership_document_multiple : JSON.parse(s.ownership_document_multiple || '[]');
                        return docs.length > 0 ? docs.map(d => `• ${d}`).join('<br>') : '—';
                      } catch(e) { return '—'; }
                    })()}
                  </div>
                ` : formatText(s.ownership_document_type)}
              </div>
            </div>
          </div>
        </section>

        <!-- UNIT 2: ENROLLMENT -->
        <section>
          <h2>Unit 2: Learners (Enrollment)</h2>
          <table>
            <thead>
              <tr>
                <th>Level</th>
                <th class="text-center">Male</th>
                <th class="text-center">Female</th>
                <th class="text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              ${[
                { id: 'kinder', label: 'Kindergarten' },
                { id: 'g1', label: 'Grade 1' },
                { id: 'g2', label: 'Grade 2' },
                { id: 'g3', label: 'Grade 3' },
                { id: 'g4', label: 'Grade 4' },
                { id: 'g5', label: 'Grade 5' },
                { id: 'g6', label: 'Grade 6' },
                { id: 'g7', label: 'Grade 7' },
                { id: 'g8', label: 'Grade 8' },
                { id: 'g9', label: 'Grade 9' },
                { id: 'g10', label: 'Grade 10' },
                { id: 'g11', label: 'Grade 11' },
                { id: 'g12', label: 'Grade 12' }
              ].filter(g => isApplicable(g.id)).map(g => `
                <tr>
                  <td>${g.label}</td>
                  <td class="text-center">${getM(g.id)}</td>
                  <td class="text-center">${getF(g.id)}</td>
                  <td class="text-center">${getGradeTotal(g.id)}</td>
                </tr>
              `).join('')}
              <tr class="font-bold">
                <td>GRAND TOTAL</td>
                <td class="text-center">${formatNumber(calculatedTotalM)}</td>
                <td class="text-center">${formatNumber(calculatedTotalF)}</td>
                <td class="text-center">${formatNumber(calculatedTotalM + calculatedTotalF)}</td>
              </tr>
            </tbody>
          </table>

          ${s.has_multigrade ? `
            <h3 style="font-size: 14px; margin-top: 15px; color: var(--primary);">Multigrade Enrollment</h3>
            <table>
              <thead>
                <tr>
                  <th>MG Grouping</th>
                  <th class="text-center">Total Enrollment</th>
                </tr>
              </thead>
              <tbody>
                ${[1, 2, 3].map(i => s[`multigrade_groupings_${i}`] ? `
                  <tr>
                    <td>${s[`multigrade_groupings_${i}`]}</td>
                    <td class="text-center">${formatNumber(s[`multigrade_enrollment_${i}`] || s[`multigrade_enrollment_${i}_total`])}</td>
                  </tr>
                ` : '').join('')}
              </tbody>
            </table>
          ` : ''}
        </section>

        <!-- UNIT 3: ORGANIZED CLASSES -->
        <section>
          <h2>Unit 3: Organized Classes</h2>
          <div class="grid">
            <div class="info-box">
              <div class="info-label">Has Multigrade?</div>
              <div class="info-value">${s.has_multigrade ? 'YES' : 'NO'}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Multigrade Sections</div>
              <div class="info-value">${formatNumber(s.multigrade_sections_count)}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Level</th>
                ${['Kinder', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'].map(g => `<th class="text-center">${g}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Class Size Info</td>
                ${['kinder', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(g => `<td class="text-center">${formatText(s[`grade_${g}_size`])}</td>`).join('')}
              </tr>
            </tbody>
          </table>

          ${s.has_multigrade ? `
            <h3 style="font-size: 14px; margin-top: 15px; color: var(--primary);">Multigrade Class Details</h3>
            <table>
              <thead>
                <tr>
                  <th>MG Grouping</th>
                  <th>Class Size Distribution</th>
                </tr>
              </thead>
              <tbody>
                ${[1, 2, 3].map(i => s[`multigrade_groupings_${i}`] ? `
                  <tr>
                    <td>${s[`multigrade_groupings_${i}`]}</td>
                    <td>${formatText(s[`multigrade_size_${i}`])}</td>
                  </tr>
                ` : '').join('')}
              </tbody>
            </table>
          ` : ''}
        </section>

        <!-- UNIT 4: LEARNER PROFILE -->
        <section>
          <h2>Unit 4: Learner Profile & Nutritional Status</h2>
          
          <h3 style="font-size: 14px; margin-top: 15px; color: var(--primary);">Demographics & Special Profiles</h3>
          <table>
            <thead>
              <tr>
                <th>Profile Category</th>
                ${['Kinder', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'].map(g => `<th class="text-center">${g}</th>`).join('')}
                <th class="text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>ALS Learners</strong></td>
                ${['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'].map(g => `<td class="text-center">${formatNumber(s[`als_${g}`])}</td>`).join('')}
                <td class="text-center font-bold">${formatNumber(s.als_total)}</td>
              </tr>
              <tr>
                <td><strong>Muslim Learners</strong></td>
                ${['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'].map(g => `<td class="text-center">${formatNumber(s[`muslim_${g}`])}</td>`).join('')}
                <td class="text-center font-bold">${formatNumber(['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'].reduce((acc, curr) => acc + (parseInt(s[`muslim_${curr}`]) || 0), 0))}</td>
              </tr>
              <tr>
                <td><strong>Indigenous People (IP)</strong></td>
                ${['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'].map(g => `<td class="text-center">${formatNumber(s[`ip_${g}`])}</td>`).join('')}
                <td class="text-center font-bold">${formatNumber(['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'].reduce((acc, curr) => acc + (parseInt(s[`ip_${curr}`]) || 0), 0))}</td>
              </tr>
              <tr>
                <td><strong>Displaced Learners</strong></td>
                ${['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'].map(g => `<td class="text-center">${formatNumber(s[`displaced_${g}`])}</td>`).join('')}
                <td class="text-center font-bold">${formatNumber(['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'].reduce((acc, curr) => acc + (parseInt(s[`displaced_${curr}`]) || 0), 0))}</td>
              </tr>
              <tr>
                <td><strong>Overage Learners</strong></td>
                ${['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'].map(g => `<td class="text-center">${formatNumber(s[`overage_${g}`])}</td>`).join('')}
                <td class="text-center font-bold">${formatNumber(['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'].reduce((acc, curr) => acc + (parseInt(s[`overage_${curr}`]) || 0), 0))}</td>
              </tr>
              <tr>
                <td><strong>LWD (Disability)</strong></td>
                ${['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'].map(g => `<td class="text-center">${formatNumber(s[`lwd_${g}`])}</td>`).join('')}
                <td class="text-center font-bold">${formatNumber(['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'].reduce((acc, curr) => acc + (parseInt(s[`lwd_${curr}`]) || 0), 0))}</td>
              </tr>
              <tr>
                <td><strong>SNED Learners</strong></td>
                ${['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'].map(g => `<td class="text-center">${formatNumber(s[`sned_${g}`])}</td>`).join('')}
                <td class="text-center font-bold">${formatNumber(['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'].reduce((acc, curr) => acc + (parseInt(s[`sned_${curr}`]) || 0), 0))}</td>
              </tr>
            </tbody>
          </table>

          <div class="grid" style="margin-top: 15px;">
             <!-- BMI SECTION -->
             <div class="info-box" style="grid-column: span 3; background: #f8fafc; border: 1px solid #e2e8f0;">
                <div class="info-label" style="color: var(--primary); font-weight: 800;">Nutritional Status (BMI Breakdown)</div>
                <div class="grid" style="grid-template-columns: repeat(4, 1fr); margin-top: 8px;">
                   <div><div style="font-size: 10px; color: #64748b;">Severely Wasted</div><div style="font-weight: 700;">${formatNumber(s.bmi_severely_wasted)}</div></div>
                   <div><div style="font-size: 10px; color: #64748b;">Wasted</div><div style="font-weight: 700;">${formatNumber(s.bmi_wasted)}</div></div>
                   <div><div style="font-size: 10px; color: #64748b;">Normal</div><div style="font-weight: 700; color: #10b981;">${formatNumber(s.bmi_normal)}</div></div>
                   <div><div style="font-size: 10px; color: #64748b;">Overweight/Obese</div><div style="font-weight: 700;">${formatNumber(s.bmi_overweight_obese)}</div></div>
                </div>
             </div>
          </div>

          <h3 style="font-size: 14px; margin-top: 20px; color: var(--primary);">Learner Movement</h3>
          <table>
            <thead>
              <tr>
                <th>Movement Type</th>
                ${['Kinder', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'].map(g => `<th class="text-center">${g}</th>`).join('')}
                <th class="text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Dropouts (Prev SY)</strong></td>
                ${['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'].map(g => `<td class="text-center">${formatNumber(s[`dropout_${g}`])}</td>`).join('')}
                <td class="text-center font-bold">${formatNumber(['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'].reduce((acc, curr) => acc + (parseInt(s[`dropout_${curr}`]) || 0), 0))}</td>
              </tr>
              <tr>
                <td><strong>Repeaters (Curr SY)</strong></td>
                ${['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'].map(g => `<td class="text-center">${formatNumber(s[`repeater_${g}`])}</td>`).join('')}
                <td class="text-center font-bold">${formatNumber(['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'].reduce((acc, curr) => acc + (parseInt(s[`repeater_${curr}`]) || 0), 0))}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- UNIT 5: SHIFTING & MODALITY -->
        <section>
          <div style="page-break-before: auto;"></div>
          <h2>Unit 5: Shifting & Delivery Modality</h2>
          
          <div class="grid">
            <div class="info-box">
              <div class="info-label">Operational Profile</div>
              <div class="info-value">${s.has_standard_shifting ? 'STANDARD SETUP' : 'MIXED / CUSTOM'}</div>
            </div>
            <div class="info-box" style="grid-column: span 3;">
              <div class="info-label">Emergency Alternative Delivery Modes (ADM) in Use</div>
              <div class="info-value" style="display: flex; gap: 10px; margin-top: 5px;">
                 <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: ${s.adm_mdl ? '#dcfce7; color: #166534;' : '#f1f5f9; color: #94a3b8;'}">Modular (MDL): ${s.adm_mdl ? 'Active' : 'N/A'}</span>
                 <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: ${s.adm_odl ? '#dcfce7; color: #166534;' : '#f1f5f9; color: #94a3b8;'}">Online (ODL): ${s.adm_odl ? 'Active' : 'N/A'}</span>
                 <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: ${s.adm_tvi ? '#dcfce7; color: #166534;' : '#f1f5f9; color: #94a3b8;'}">TV/Radio (TVI): ${s.adm_tvi ? 'Active' : 'N/A'}</span>
                 <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: ${s.adm_blended ? '#dcfce7; color: #166534;' : '#f1f5f9; color: #94a3b8;'}">Blended: ${s.adm_blended ? 'Active' : 'N/A'}</span>
              </div>
            </div>
          </div>

          <h3 style="font-size: 14px; margin-top: 15px; color: var(--primary);">Grade-Level Instructional Delivery Profile</h3>
          ${!s.has_standard_shifting ? `
            <table>
              <thead>
                <tr>
                  <th>Grade Level</th>
                  <th>Shifting Model</th>
                  <th>Delivery Modality</th>
                </tr>
              </thead>
              <tbody>
                ${['kinder', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'].map(g => s[`shift_${g}`] ? `
                  <tr>
                    <td><strong>${g === 'kinder' ? 'Kinder' : 'Grade ' + g.replace('g','')}</strong>${s.has_multigrade ? ' (Monograde)' : ''}</td>
                    <td>${formatText(s[`shift_${g}`])}</td>
                    <td>${formatText(s[`mode_${g}`])}</td>
                  </tr>
                ` : '').join('')}
                ${[1, 2, 3].map(i => s[`multigrade_groupings_${i}`] ? `
                  <tr style="background: #f8fafc;">
                    <td><strong>${s[`multigrade_groupings_${i}`]}</strong> (Multigrade)</td>
                    <td>${formatText(s[`shift_mg_${i}`])}</td>
                    <td>${formatText(s[`mode_mg_${i}`])}</td>
                  </tr>
                ` : '').join('')}
              </tbody>
            </table>
          ` : `
            <div style="padding: 15px; border: 2px dashed #e2e8f0; border-radius: 8px; text-align: center; color: #64748b; font-style: italic;">
              All grade levels follow the standard <span style="font-weight: 800; color: var(--primary); font-style: normal;">Single Shift</span> schedule 
              with <span style="font-weight: 800; color: #10b981; font-style: normal;">In-Person Classes</span> as the primary delivery mode.
            </div>
          `}
        </section>

        <!-- PERSONNEL INFORMATION (CONDITIONAL) -->
        ${userRole !== 'School Head' ? `
        <section>
          <h2>Teaching Personnel Information</h2>
          <div class="grid">
            <div class="info-box">
              <div class="info-label">Total Registered</div>
              <div class="info-value">${formatNumber(s.total_teachers_registered)}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Kinder Teachers</div>
              <div class="info-value">${formatNumber(s.total_teachers_kinder)}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Elementary Teachers</div>
              <div class="info-value">${formatNumber(s.total_teachers_elementary)}</div>
            </div>
            <div class="info-box">
              <div class="info-label">JHS / SHS Teachers</div>
              <div class="info-value">${formatNumber(s.total_teachers_jhs)} / ${formatNumber(s.total_teachers_shs)}</div>
            </div>
          </div>
        </section>
        ` : ''}

        <!-- UNIT 6: RESOURCES -->
        <section>
          <h2>Unit 6: School Resources & Utilities</h2>
          
          <div class="grid" style="margin-bottom: 15px;">
            <div class="info-box" style="grid-column: span 3; background: #eff6ff; border: 1px solid #dbeafe;">
              <div class="info-label" style="color: var(--primary);">Combined Utility Sources</div>
              <div class="grid" style="grid-template-columns: repeat(3, 1fr); margin-top: 5px;">
                <div><strong>Water Source:</strong> ${safeParse(s.unit7_wash)?.water_source || '—'}</div>
                <div><strong>Main Power Source:</strong> ${safeParse(s.unit7_utilities)?.utility_electricity || safeParse(s.u9_general)?.main_power_source || '—'}</div>
                <div><strong>Internet Type:</strong> ${(s.u7_utility_internet_type || safeParse(s.unit7_ict)?.internet_type || safeParse(s.unit7_utilities)?.utility_internet_type) || 'None'}</div>
              </div>
            </div>
          </div>

          <div class="grid">
            <div class="info-box" style="grid-column: span 1;">
              <div class="info-label">Sanitation & WASH Facilities</div>
              <div class="info-value">${renderWashInfo(s.unit7_wash)}</div>
            </div>
            <div class="info-box" style="grid-column: span 1;">
              <div class="info-label">Furniture Summary</div>
              <div class="info-value">${renderFurnitureInfo(s.unit7_furniture)}</div>
            </div>
            <div class="info-box" style="grid-column: span 2;">
              <div class="info-label">ICT Resources & Equipment</div>
              <div class="info-value">${renderICTInfo(s.unit7_ict)}</div>
            </div>
          </div>
        </section>

        <!-- UNIT 7: PHYSICAL FACILITIES -->
        <section>
          <h2>Unit 7: Physical Facilities (Building Inventory)</h2>
          <div class="grid" style="grid-template-columns: repeat(2, 1fr); margin-bottom: 10px;">
            <div class="info-box">
              <div class="info-label">Total Bldgs Registered</div>
              <div class="info-value">${unit7Master ? unit7Master.length : ((parseInt(s.bldg_count_good) || 0) + (parseInt(s.bldg_count_minor_repair) || 0) + (parseInt(s.bldg_count_major_repair) || 0))}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Bldgs: Good Condition</div>
              <div class="info-value">${formatNumber(s.bldg_count_good)}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Bldgs: Minor Repair Required</div>
              <div class="info-value">${formatNumber(s.bldg_count_minor_repair)}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Bldgs: Major Repair Required</div>
              <div class="info-value">${formatNumber(s.bldg_count_major_repair)}</div>
            </div>
          </div>
          
          <h3>Building Inventory Details</h3>
          ${unit7Master && unit7Master.length > 0 ? `
            <div style="margin-top: 10px;">
              ${unit7Master.map(b => `
                <div style="margin-bottom: 25px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; page-break-inside: avoid;">
                  <div style="background: var(--bg-light); padding: 10px 15px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 700; color: var(--primary); font-size: 15px;">${b.building_name}</div>
                  </div>
                  <div style="padding: 15px;">
                    <div class="grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 15px;">
                      <div>
                        <div class="info-label">Storeys</div>
                        <div class="info-value" style="font-size: 13px;">${b.no_of_storeys || b.storey || '1'}</div>
                      </div>
                      <div>
                        <div class="info-label">Total Rooms</div>
                        <div class="info-value" style="font-size: 13px;">${b.no_of_classrooms || b.classroom || (b.rooms ? b.rooms.length : 0)}</div>
                      </div>
                      <div>
                        <div class="info-label">Remarks</div>
                        <div class="info-value" style="font-size: 13px;">${b.remarks || '—'}</div>
                      </div>
                    </div>
                    
                    <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">Room Inventory Details</div>
                    ${renderRoomsTable(b.rooms)}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<p style="font-size: 13px; color: var(--text-muted);">No building inventory data found.</p>'}
        </section>

        <!-- UNIT 8: TERRAIN -->
        <section>
          <h2>Unit 8: School Terrain & Hazards</h2>
          ${unit8Terrain ? `
            <div class="grid">
              <div class="info-box">
                <div class="info-label">Cellular Connectivity</div>
                <div class="info-value">${formatText(unit8Terrain.cellular_coverage)}</div>
              </div>
              <div class="info-box">
                <div class="info-label">Road Type (Mun. Hall route)</div>
                <div class="info-value">${unit8Terrain.road_paved_pct || 0}% Paved / ${unit8Terrain.road_unpaved_pct || 0}% Unpaved</div>
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Passable for Public Transpo: ${unit8Terrain.road_passable_public_transpo_pct || 0}%</div>
              </div>
              <div class="info-box">
                <div class="info-label">Accessibility & Security</div>
                <div style="font-size: 11px; margin-top: 5px;">
                  <div><strong>Insurgency Threats:</strong> ${unit8Terrain.has_insurgency_threats ? (unit8Terrain.insurgency_threats_6mo > 0 ? `YES (${unit8Terrain.insurgency_threats_6mo} incidences in past 6mo)` : 'YES') : 'NO'}</div>
                </div>
              </div>
              <div class="info-box">
                <div class="info-label">River Crossing (on foot)</div>
                <div class="info-value">${unit8Terrain.river_crossing_on_foot ? `YES (${unit8Terrain.river_crossing_count} sites)` : 'NO'}</div>
              </div>
            </div>

            <h3 style="font-size: 14px; margin-top: 15px; color: var(--primary);">Proximity Matrix (Nearest Critical Services)</h3>
            <table>
              <thead>
                <tr>
                  <th>Point of Interest</th>
                  <th class="text-center">Distance (KM)</th>
                  <th class="text-center">Travel Time (Mins)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Hospital / Medical Clinic</strong></td>
                  <td class="text-center">${unit8Terrain.proximity_hospital_km || '0'} km</td>
                  <td class="text-center">${unit8Terrain.emergency_response_mins || '0'} mins</td>
                </tr>
                <tr>
                  <td><strong>Barangay Hall</strong></td>
                  <td class="text-center">${unit8Terrain.proximity_brgy_hall_km || '0'} km</td>
                  <td class="text-center">${unit8Terrain.proximity_brgy_hall_mins || '0'} mins</td>
                </tr>
                <tr>
                  <td><strong>Municipal Hall</strong></td>
                  <td class="text-center">${unit8Terrain.proximity_muni_hall_km || '0'} km</td>
                  <td class="text-center">${unit8Terrain.proximity_muni_hall_mins || '0'} mins</td>
                </tr>
                <tr>
                  <td><strong>Schools Division Office (SDO)</strong></td>
                  <td class="text-center">${unit8Terrain.proximity_sdo_km || '0'} km</td>
                  <td class="text-center">${unit8Terrain.proximity_sdo_mins || '0'} mins</td>
                </tr>
                <tr>
                  <td><strong>Public Transport Terminal</strong></td>
                  <td class="text-center">${unit8Terrain.proximity_terminal_km || '0'} km</td>
                  <td class="text-center">${unit8Terrain.proximity_terminal_mins || '0'} mins</td>
                </tr>
              </tbody>
            </table>

            <div class="grid" style="margin-top: 15px;">
              <div class="info-box" style="grid-column: span 1;">
                <div class="info-label">Environmental Hazards (Geographic)</div>
                <div style="font-size: 11px; margin-top: 5px;">
                  <div style="margin-bottom: 4px;"><strong>Near Cliff/Ravine:</strong> ${unit8Terrain.near_cliff_ravine ? `YES (${unit8Terrain.road_cliff_pct}% route exposure)` : 'NO'}</div>
                  <div style="margin-bottom: 8px;"><strong>Near Water Body:</strong> ${unit8Terrain.near_water ? 'YES' : 'NO'}</div>
                  
                  ${(() => {
                    const water = typeof unit8Terrain.water_proximity === 'string' ? JSON.parse(unit8Terrain.water_proximity || '[]') : (unit8Terrain.water_proximity || []);
                    if (water.length === 0) return '';
                    return `
                      <div class="tag-container">
                        ${water.map(w => `<span class="tag tag-blue">${w.type} (${w.distance_km}km)</span>`).join('')}
                      </div>
                    `;
                  })()}
                </div>
              </div>

              <div class="info-box" style="grid-column: span 1;">
                <div class="info-label">Natural Calamities (Past 6 months)</div>
                <div class="tag-container" style="margin-bottom: 10px;">
                  ${(() => {
                    const cals = typeof unit8Terrain.natural_calamities === 'string' ? JSON.parse(unit8Terrain.natural_calamities || '[]') : (unit8Terrain.natural_calamities || []);
                    if (cals.length === 0) return '<span style="color: var(--text-muted); font-style: italic;">No calamities reported.</span>';
                    return cals.map(c => `<span class="tag tag-orange">${c.type} (${c.incidences})</span>`).join('');
                  })()}
                </div>

                <div class="info-label">Anthropogenic Threats (Social Conflicts)</div>
                <div class="tag-container">
                  ${(() => {
                    const threats = typeof unit8Terrain.anthropogenic_threats === 'string' ? JSON.parse(unit8Terrain.anthropogenic_threats || '[]') : (unit8Terrain.anthropogenic_threats || []);
                    if (threats.length === 0) return '<span style="color: var(--text-muted); font-style: italic;">No threats reported.</span>';
                    return threats.map(t => `<span class="tag tag-red">${t.type} (${t.incidences})</span>`).join('');
                  })()}
                </div>
                
                <div class="info-label" style="margin-top: 15px;">Other Hazards Experienced</div>
                <div class="tag-container">
                  ${(() => {
                    let haz = [];
                    try {
                      haz = typeof unit8Terrain.hazards_experienced === 'string' ? JSON.parse(unit8Terrain.hazards_experienced || '[]') : (unit8Terrain.hazards_experienced || []);
                      if (typeof haz === 'string') haz = haz.split(',').map(h => h.trim());
                    } catch(e) { 
                      if (typeof unit8Terrain.hazards_experienced === 'string') haz = unit8Terrain.hazards_experienced.split(',').map(h => h.trim());
                    }
                    if (haz.length === 0) return '<span style="color: var(--text-muted); font-style: italic;">No specific hazards reported.</span>';
                    return haz.map(h => `<span class="tag tag-slate">${h}</span>`).join('');
                  })()}
                </div>
              </div>
            </div>
          ` : '<p style="font-size: 13px; color: var(--text-muted);">No terrain or accessibility data found.</p>'}
        </section>

        <!-- UNIT 9: INFRASTRUCTURE -->
        <section>
          <h2>Unit 9: Infrastructure & Safety Audit</h2>
          ${renderInfrastructureUnit(s)}
        </section>


        <footer style="margin-top: 50px; border-top: 1px solid var(--border); padding-top: 20px; text-align: center; color: var(--text-muted); font-size: 11px;">
          <p>© 2026 InsightEd Monitoring System | Department of Education</p>
          <p>This is a computer-generated report. No signature required.</p>
        </footer>
      </div>
      
      <div class="no-print" style="position: fixed; bottom: 20px; right: 20px;">
        <button onclick="window.print()" style="background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          🖨️ Print to PDF
        </button>
      </div>
    </body>
    </html>
  `;

  return html;
};

export const downloadPrintableReport = (data, unit7Master, unit8Terrain, userRole) => {
  const html = generateSchoolReportHTML(data, unit7Master, unit8Terrain, userRole);
  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
};
