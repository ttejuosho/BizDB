console.log("script.js loaded");
const $spinner = $("#spinner");
const $resultsDiv = $("#resultsDiv");
const $searchInfo = $("#searchInfo");
const $statusText = $("#statusText");
const $yearsFacet = $("#yearsFacet");
const $selectedFacetSummary = $("#selectedFacetSummary");

function showSpinner() {
  $spinner.removeAttr("hidden");
}
function hideSpinner() {
  $spinner.attr("hidden", true);
}

function setStatus(text) {
  $statusText.text(text);
}

function parseMultiValues(selectize) {
  const v = selectize.getValue();
  if (!v) return [];
  return Array.isArray(v) ? v : String(v).split(",").filter(Boolean);
}

function buildQuery(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) {
      if (v.length === 0) return;
      usp.set(k, v.join(","));
      return;
    }
    const s = String(v).trim();
    if (s.length === 0) return;
    usp.set(k, s);
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

function safeNum(val) {
  const s = String(val ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Formats a number as a currency string using the Internationalization API.
 * @param {number} amount - The numeric value to format (e.g., 12345.67).
 * @param {string} locale - The BCP 47 language tag (e.g., 'en-US', 'de-DE', 'en-GB').
 * @param {string} currencyCode - The ISO 4217 currency code (e.g., 'USD', 'EUR', 'GBP').
 * @returns {string} The formatted currency string (e.g., "$12,345.67").
 */
function formatMoney(amount, locale = "en-US", currencyCode = "USD") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}

function appendVehicleCard(vehicle) {
  // Helper to render value safely
  const v = (val) =>
    escapeHtml(
      val === null || val === undefined || val === "" ? "—" : String(val)
    );

  // Title
  const title =
    `${vehicle.Year ?? ""} ${vehicle.Make ?? ""} ${
      vehicle.Model_Details ?? vehicle.Model_Group ?? ""
    }`.trim() || "Vehicle";

  // Image (your Image_Thumbnail is missing protocol; Image_URL is an API endpoint, not a JPG)
  const thumbSrc = vehicle.Image_Thumbnail
    ? String(vehicle.Image_Thumbnail).startsWith("http")
      ? vehicle.Image_Thumbnail
      : `https://${vehicle.Image_Thumbnail}`
    : "";

  const imgHtml = thumbSrc
    ? `
      <div class="vehicle-thumb-wrap">
        <img class="vehicle-thumb" alt="Vehicle thumbnail" src="${escapeHtml(
          thumbSrc
        )}" loading="lazy" />
      </div>
    `
    : `
      <div class="vehicle-thumb-wrap vehicle-thumb-empty">
        <div class="text-muted small">No image</div>
      </div>
    `;

  // Small badge row for quick scan
  const badges = `
    <div class="d-flex flex-wrap align-items-center mb-2">
    <span class="badge badge-success mr-2 mb-1 p-2">${v(
      formatMoney(vehicle.High_Bid)
    )}</span>
      <span class="badge badge-dark mr-2 mb-1 p-2">${v(
        vehicle.Sale_Status
      )}</span>
      <span class="badge badge-secondary mr-2 mb-1 p-2">${v(
        vehicle.Location_State
      )}</span>
      <span class="badge badge-light border mr-2 mb-1 p-2">Item ${v(
        vehicle.Item_Number
      )}</span>
      <span class="badge badge-light border mr-2 mb-1 p-2">${v(
        vehicle.Vehicle_Type
      )}</span>
    </div>
  `;

  // Layout: left image + right content, then a clean 2-column grid of all fields
  const html = `
    <style>
      /* Scoped card styles */
      .vehicle-card { border: 1px solid rgba(0,0,0,.08); border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,.04); }
      .vehicle-card .card-header { background: #fff; border-bottom: 1px solid rgba(0,0,0,.06); border-top-left-radius: 12px; border-top-right-radius: 12px; }
      .vehicle-title { font-weight: 700; margin: 0; }
      .vehicle-subtitle { color: #6c757d; margin: 0; }
      .vehicle-thumb-wrap { width: 100%; max-width: 260px; border-radius: 12px; overflow: hidden; border: 1px solid rgba(0,0,0,.08); background: #f8f9fa; }
      .vehicle-thumb { display: block; width: 100%; height: auto; }
      .vehicle-thumb-empty { display:flex; align-items:center; justify-content:center; height: 160px; }
      .vehicle-kv { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; }
      @media (max-width: 768px) { .vehicle-kv { grid-template-columns: 1fr; } .vehicle-thumb-wrap { max-width: 100%; } }
      .kv-item { padding: 8px 10px; border: 1px solid rgba(0,0,0,.06); border-radius: 10px; background: #fff; }
      .kv-label { font-size: 12px; color: #6c757d; text-transform: uppercase; letter-spacing: .02em; margin-bottom: 2px; }
      .kv-value { font-size: 14px; color: #212529; font-weight: 600; word-break: break-word; }
      .vehicle-actions a { text-decoration: none; }
      .vehicle-actions .btn { border-radius: 10px; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    </style>

    <div class="col-12 col-xl-10 mb-4">
      <div class="card vehicle-card">
        <div class="card-header py-3">
          <div class="d-flex flex-wrap justify-content-between align-items-start">
            <div class="pr-3">
              <h5 class="vehicle-title">${escapeHtml(title)}</h5>
              <p class="vehicle-subtitle medium mb-0">
                VIN: <span class="mono">${v(vehicle.VIN)}</span>
              </p>
              <p class="vehicle-subtitle medium mb-0">
                Lot Number: <span class="mono">${v(vehicle.Lot_Number)}</span>
              </p>
            </div>
            <div class="vehicle-actions mt-2 mt-md-0">
              ${
                vehicle.Image_URL
                  ? `<a class="btn btn-outline-dark btn-sm" href="${escapeHtml(
                      vehicle.Image_URL
                    )}" target="_blank" rel="noopener">Open Image Feed</a>`
                  : ""
              }
            </div>
          </div>
        </div>

        <div class="card-body">
          ${badges}

          <div class="row">
            <div class="col-12 col-md-4 mb-3">
              ${imgHtml}
              <div class="mt-2 small text-muted">
                Yard: ${v(vehicle.Yard_Name)} (${v(vehicle.Yard_Number)})
              </div>
            </div>

            <div class="col-12 col-md-8">
              <div class="vehicle-kv">
                <div class="kv-item"><div class="kv-label">Vehicle Sale Id</div><div class="kv-value">${v(
                  vehicle.Vehicle_Sale_Id
                )}</div></div>
                <div class="kv-item"><div class="kv-label">Record Id</div><div class="kv-value">${v(
                  vehicle.id
                )}</div></div>

                <div class="kv-item"><div class="kv-label">Sale Date</div><div class="kv-value">${v(
                  vehicle.Sale_Date
                )}</div></div>
                <div class="kv-item"><div class="kv-label">Sale Time</div><div class="kv-value">${v(
                  vehicle.Sale_Time_HHMM
                )} ${v(vehicle.Time_Zone)} (${v(
    vehicle.Day_of_Week
  )})</div></div>

                <div class="kv-item"><div class="kv-label">Lot / Item</div><div class="kv-value">Lot ${v(
                  vehicle.Lot_Number
                )} • Item ${v(vehicle.Item_Number)}</div></div>
                <div class="kv-item"><div class="kv-label">Grid / Row</div><div class="kv-value">${v(
                  vehicle.Grid_Row
                )}</div></div>

                <div class="kv-item"><div class="kv-label">Year / Make / Model</div><div class="kv-value">${v(
                  vehicle.Year
                )} • ${v(vehicle.Make)} • ${v(vehicle.Model_Group)}</div></div>
                <div class="kv-item"><div class="kv-label">Model Details / Trim</div><div class="kv-value">${v(
                  vehicle.Model_Details
                )} • ${v(vehicle.Trim)}</div></div>

                <div class="kv-item"><div class="kv-label">Body Style / Color</div><div class="kv-value">${v(
                  vehicle.Body_Style
                )} • ${v(vehicle.Color)}</div></div>
                <div class="kv-item"><div class="kv-label">Location</div><div class="kv-value">${v(
                  vehicle.Location_City
                )}, ${v(vehicle.Location_State)} ${v(
    vehicle.Location_Zip
  )} • ${v(vehicle.Location_Country)}</div></div>

                <div class="kv-item"><div class="kv-label">Damage</div><div class="kv-value">${v(
                  vehicle.Damage_Description
                )}${
    vehicle.Secondary_Damage ? " • " + v(vehicle.Secondary_Damage) : ""
  }</div></div>
                <div class="kv-item"><div class="kv-label">Keys / Title</div><div class="kv-value">Keys: ${v(
                  vehicle.Has_Keys
                )} • ${v(vehicle.Sale_Title_State)} / ${v(
    vehicle.Sale_Title_Type
  )}</div></div>

                <div class="kv-item"><div class="kv-label">Odometer</div><div class="kv-value">${v(
                  vehicle.Odometer
                )} (${v(vehicle.Odometer_Brand)})</div></div>
                <div class="kv-item"><div class="kv-label">Runs / Drives</div><div class="kv-value">${v(
                  vehicle.Runs_Drives
                )}</div></div>

                <div class="kv-item"><div class="kv-label">Engine / Cylinders</div><div class="kv-value">${v(
                  vehicle.Engine
                )} • ${v(vehicle.Cylinders)} cyl</div></div>
                <div class="kv-item"><div class="kv-label">Drive / Transmission</div><div class="kv-value">${v(
                  vehicle.Drive
                )} • ${v(vehicle.Transmission)}</div></div>

                <div class="kv-item"><div class="kv-label">Fuel Type</div><div class="kv-value">${v(
                  vehicle.Fuel_Type
                )}</div></div>
                <div class="kv-item"><div class="kv-label">Vehicle Type</div><div class="kv-value">${v(
                  vehicle.Vehicle_Type
                )}</div></div>

                <div class="kv-item"><div class="kv-label">Retail Value</div><div class="kv-value">${v(
                  formatMoney(vehicle.Estimated_Retail_Value)
                )}</div></div>
                <div class="kv-item"><div class="kv-label">Repair Cost</div><div class="kv-value">${v(
                  formatMoney(vehicle.Repair_Cost)
                )}</div></div>

                <div class="kv-item"><div class="kv-label">Sale Status / High Bid</div><div class="kv-value">${v(
                  vehicle.Sale_Status
                )} • ${v(formatMoney(vehicle.High_Bid))}</div></div>
                <div class="kv-item"><div class="kv-label">Special Note</div><div class="kv-value">${v(
                  vehicle.Special_Note
                )}</div></div>

                <div class="kv-item"><div class="kv-label">Make an Offer Eligible</div><div class="kv-value">${
                  vehicle.Make_an_Offer_Eligible === true
                    ? "Yes"
                    : vehicle.Make_an_Offer_Eligible === false
                    ? "No"
                    : "—"
                }</div></div>
                <div class="kv-item"><div class="kv-label">Buy It Now Price</div><div class="kv-value">${v(
                  formatMoney(vehicle.Buy_it_Now_Price)
                )}</div></div>

                <div class="kv-item"><div class="kv-label">Create Date/Time</div><div class="kv-value">${v(
                  vehicle.Create_DateTime
                )}</div></div>
                <div class="kv-item"><div class="kv-label">Last Updated</div><div class="kv-value">${v(
                  vehicle.Last_Updated_Time
                )}</div></div>
              </div>
            </div>
          </div>
        </div>

        <div class="card-footer bg-white border-top-0 pt-0 pb-3 px-3">
          <div class="small text-muted">
            Lot Condition Code: ${v(
              vehicle.Lot_Condition_Code
            )} • Currency: ${v(vehicle.Currency_Code)}
          </div>
        </div>
      </div>
    </div>
  `;

  $resultsDiv.append(html);
}

// =========================================
// Selectize setup
// =========================================
const makesSelectize = $("#makesSelect").selectize({
  plugins: ["remove_button"],
  maxItems: null,
  valueField: "make_id",
  labelField: "make_name",
  searchField: ["make_name", "make_code"],
  placeholder: "Select makes...",
  onChange: async function () {
    await refreshModelsFacet();
    await refreshYearsFacet();
    updateSelectedSummary();
  },
})[0].selectize;

const modelsSelectize = $("#modelsSelect").selectize({
  plugins: ["remove_button"],
  maxItems: null,
  valueField: "model_id",
  labelField: "model_name",
  searchField: ["model_name", "model_code"],
  placeholder: "Select models...",
  onChange: async function () {
    await refreshYearsFacet();
    updateSelectedSummary();
  },
})[0].selectize;

// =========================================
// Facet loading
// =========================================
async function loadMakesFacet() {
  setStatus("Loading makes...");
  const res = await fetch("/api/makes");
  if (!res.ok) throw new Error(`Failed to load makes: ${res.status}`);
  const data = await res.json();

  // Expect either { results: [...] } or [...]
  const makes = Array.isArray(data) ? data : data.results ?? data.makes ?? [];

  makesSelectize.clearOptions();
  makesSelectize.addOption(makes);
  makesSelectize.refreshOptions(false);

  setStatus(`Loaded ${makes.length} makes.`);
}

async function refreshModelsFacet() {
  const makeIds = parseMultiValues(makesSelectize);

  // Clear models if no makes
  if (makeIds.length === 0) {
    modelsSelectize.clear(true);
    modelsSelectize.clearOptions();
    modelsSelectize.refreshOptions(false);
    return;
  }

  setStatus("Loading models...");
  const url = "/api/models" + buildQuery({ makeId: makeIds });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load models: ${res.status}`);
  const data = await res.json();
  const models = Array.isArray(data) ? data : data.results ?? data.models ?? [];

  // Keep any selected models that still exist
  const selectedBefore = new Set(parseMultiValues(modelsSelectize));
  const nextSelected = [];

  modelsSelectize.clearOptions();
  modelsSelectize.addOption(models);
  modelsSelectize.refreshOptions(false);

  for (const m of models) {
    if (selectedBefore.has(m.model_id)) nextSelected.push(m.model_id);
  }
  modelsSelectize.setValue(nextSelected, true);
  setStatus(`Loaded ${models.length} models.`);
}

async function refreshYearsFacet() {
  const makeIds = parseMultiValues(makesSelectize);
  const modelIds = parseMultiValues(modelsSelectize);

  if (makeIds.length === 0) {
    $yearsFacet.text("—");
    return;
  }

  setStatus("Loading years facet...");
  const url =
    "/api/vehicles/distinct/years" +
    buildQuery({
      makeId: makeIds,
      modelId: modelIds.length ? modelIds : null,
      limit: 5000,
      offset: 0,
    });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load years facet: ${res.status}`);
  const data = await res.json();

  const buckets = data?.data?.buckets ?? [];

  const byMake = buckets
    .filter((b) => b && b.key)
    .map((b) => {
      const years = (b.values ?? [])
        .map((x) => Number(x.key))
        .filter((n) => Number.isFinite(n));
      years.sort((a, b) => a - b);
      return { makeId: b.key, years };
    });

  // Union view (for quick glance)
  const yearSet = new Set();
  byMake.forEach((m) => m.years.forEach((y) => yearSet.add(y)));
  const unionYears = Array.from(yearSet).sort((a, b) => a - b);

  if (unionYears.length === 0) {
    $yearsFacet.text("No years found for current filters.");
  } else {
    const minY = unionYears[0];
    const maxY = unionYears[unionYears.length - 1];
    $yearsFacet.text(
      `${minY} → ${maxY} (${unionYears.length} distinct years across selection)`
    );
  }

  setStatus("Years facet updated.");
}

function updateSelectedSummary() {
  const makeIds = parseMultiValues(makesSelectize);
  const modelIds = parseMultiValues(modelsSelectize);
  const fromYear = safeNum($("#fromYear").val());
  const toYear = safeNum($("#toYear").val());

  const parts = [];
  parts.push(makeIds.length ? `${makeIds.length} make(s)` : "no makes");
  parts.push(modelIds.length ? `${modelIds.length} model(s)` : "no models");
  if (fromYear || toYear)
    parts.push(`years: ${fromYear ?? "—"} to ${toYear ?? "—"}`);

  $selectedFacetSummary.text(parts.join(" • "));
}

async function loadResults() {
  const makeIds = parseMultiValues(makesSelectize);
  const modelIds = parseMultiValues(modelsSelectize);

  const fromYear = safeNum($("#fromYear").val());
  const toYear = safeNum($("#toYear").val());
  const vin = String($("#vinQuery").val() ?? "").trim();

  const limit = Math.min(Number($("#limit").val() ?? 100), 1000);
  const offset = Math.max(Number($("#offset").val() ?? 0), 0);

  // Minimal requirement: at least one make (faceted UX)
  if (makeIds.length === 0) {
    alert("Select at least one make.");
    return;
  }

  showSpinner();
  setStatus("Loading results...");

  // This assumes you update /api/getVehicles to support these filters.
  // If you have a dedicated search endpoint (recommended), swap the URL here.
  const url =
    "/api/getVehicles" +
    buildQuery({
      limit,
      offset,
      makeId: makeIds,
      modelId: modelIds.length ? modelIds : null,
      fromYear,
      toYear,
      vin,
    });

  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to load results: ${r.status}`);
  const payload = await r.json();
  console.log("Results payload:", payload);

  // Support either { results: [...] } or direct array
  const results = payload.results ?? [];
  const meta = payload.meta ?? null;

  $resultsDiv.empty();
  results.forEach(appendVehicleCard);

  const returned = results.length;
  const msg = meta
    ? `Showing ${returned} result(s). limit=${meta.limit}, offset=${meta.offset}`
    : `Showing ${returned} result(s).`;
  $searchInfo.text(msg);

  setStatus("Results loaded.");
  hideSpinner();
}

// =========================================
// Events
// =========================================
$("#applyFiltersBtn").click(async () => {
  try {
    updateSelectedSummary();
    await refreshYearsFacet();
    await loadResults();
  } catch (e) {
    console.error(e);
    hideSpinner();
    setStatus("Error.");
    alert(e.message || e);
  }
});

$("#refreshFacetsBtn").click(async () => {
  try {
    updateSelectedSummary();
    await refreshModelsFacet();
    await refreshYearsFacet();
  } catch (e) {
    console.error(e);
    setStatus("Error refreshing facets.");
    alert(e.message || e);
  }
});

$("#resetFiltersBtn").click(async () => {
  makesSelectize.clear(true);
  modelsSelectize.clear(true);
  modelsSelectize.clearOptions();
  $("#fromYear").val("");
  $("#toYear").val("");
  $("#vinQuery").val("");
  $("#limit").val("100");
  $("#offset").val("0");
  $yearsFacet.text("—");
  $selectedFacetSummary.text("—");
  $resultsDiv.empty();
  $searchInfo.text("");
  setStatus("Reset.");
});

$("#facetForm").on("submit", function (e) {
  e.preventDefault();
  $("#applyFiltersBtn").click();
});

(async function boot() {
  try {
    showSpinner();
    await loadMakesFacet();
    updateSelectedSummary();
    hideSpinner();
  } catch (e) {
    console.error(e);
    hideSpinner();
    setStatus("Error during initialization.");
    alert(e.message || e);
  }
})();
