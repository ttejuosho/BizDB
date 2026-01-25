// =========================
// UPDATED script.js (drop-in)
// =========================
console.log("script.js loaded");

const $spinner = $("#spinner");
const $resultsDiv = $("#resultsDiv");
const $searchInfo = $("#searchInfo");
const $statusText = $("#statusText");
const $yearsFacet = $("#yearsFacet");
const $selectedFacetSummary = $("#selectedFacetSummary");
const $activeFilterChips = $("#activeFilterChips");
const $emptyState = $("#emptyState");
const $pageIndicator = $("#pageIndicator");

const $prevPageBtn = $("#prevPageBtn");
const $nextPageBtn = $("#nextPageBtn");

const $perPage = $("#perPage");
const $sortBy = $("#sortBy");

const $onlyWithImages = $("#onlyWithImages");
const $onlyOfferEligible = $("#onlyOfferEligible");
const $onlyHasBid = $("#onlyHasBid");

const $saleDateFrom = $("#saleDateFrom");
const $saleDateTo = $("#saleDateTo");

const $odometerMin = $("#odometerMin");
const $odometerMax = $("#odometerMax");

const $highBidMin = $("#highBidMin");
const $highBidMax = $("#highBidMax");

const $buyItNowMin = $("#buyItNowMin");
const $buyItNowMax = $("#buyItNowMax");

const $trimQuery = $("#trimQuery");

let appState = {
  pageIndex: 0,
  limit: Number($perPage.val() ?? 100) || 100,
  sortBy: String($sortBy.val() ?? "saleDateDesc"),
  lastMeta: null,
  isLoading: false,
};

function showSpinner() {
  $spinner.removeAttr("hidden");
}
function hideSpinner() {
  $spinner.attr("hidden", true);
}
function setStatus(text) {
  $statusText.text(text);
}
function formatTimestamp(input, locale = "en-US") {
  const s = String(input ?? "").trim();
  if (!s) return "—";

  // Copart-style: 2020-06-30-10.51.03.000729
  const copart = s.match(
    /^(\d{4})-(\d{2})-(\d{2})-(\d{2})\.(\d{2})\.(\d{2})\.(\d+)$/
  );
  if (copart) {
    const [, y, mo, d, hh, mm, ss] = copart;
    const dt = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss)
    );
    if (Number.isNaN(dt.getTime())) return s;

    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(dt);
  }

  // ISO 8601 (and most other Date-parseable formats)
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return s;

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(dt);
}

// =========================
// NEW Selectize setup (states, statuses, runs/drives, title types)
// =========================

const statesSelectize = $("#locationStatesSelect").selectize({
  plugins: ["remove_button"],
  maxItems: null,
  valueField: "value",
  labelField: "label",
  searchField: ["label", "value"],
  placeholder: "Select state(s)...",
})[0].selectize;

const saleStatusesSelectize = $("#saleStatusesSelect").selectize({
  plugins: ["remove_button"],
  maxItems: null,
  valueField: "value",
  labelField: "label",
  searchField: ["label", "value"],
  placeholder: "Select sale status(es)...",
})[0].selectize;

const runsDrivesSelectize = $("#runsDrivesSelect").selectize({
  plugins: ["remove_button"],
  maxItems: null,
  valueField: "value",
  labelField: "label",
  searchField: ["label", "value"],
  placeholder: "Select Runs/Drives...",
})[0].selectize;

const titleTypesSelectize = $("#titleTypesSelect").selectize({
  plugins: ["remove_button"],
  maxItems: null,
  valueField: "value",
  labelField: "label",
  searchField: ["label", "value"],
  placeholder: "Select title type(s)...",
})[0].selectize;

// Populate options (static to start; you can replace with facet endpoints later)
(function seedFilterOptions() {
  const US_STATES = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
    "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
    "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
  ].map(s => ({ value: s, label: s }));

  const SALE_STATUSES = [
    "Pure Sale",
    "Minimum Bid",
    "On Approval",
    "Sold",
    "No Sale",
  ].map(s => ({ value: s, label: s }));

  const RUNS_DRIVES = [
    "Run & Drive Verified",
    "Run & Drive",
    "DEFAULT",
  ].map(s => ({ value: s, label: s }));

  const TITLE_TYPES = [
    { value: "CT", label: "CT — Clean Title" },
    { value: "RT", label: "RT — Rebuilt Title" },
    { value: "ST", label: "ST — Salvage Title" },
  ];

  statesSelectize.addOption(US_STATES);
  saleStatusesSelectize.addOption(SALE_STATUSES);
  runsDrivesSelectize.addOption(RUNS_DRIVES);
  titleTypesSelectize.addOption(TITLE_TYPES);

  statesSelectize.refreshOptions(false);
  saleStatusesSelectize.refreshOptions(false);
  runsDrivesSelectize.refreshOptions(false);
  titleTypesSelectize.refreshOptions(false);
})();

function normalizeDateInput(val) {
  const s = String(val ?? "").trim();
  if (!s) return null;

  // Allow yyyy-mm-dd or yyyymmdd; otherwise send raw (your API parser can handle ISO)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{8}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s; // ISO timestamps are OK too

  return s;
}


function setLoading(isLoading, statusText) {
  appState.isLoading = isLoading;
  if (typeof statusText === "string") setStatus(statusText);

  // Disable core actions while loading
  $("#applyFiltersBtn").prop("disabled", isLoading);
  $("#resetFiltersBtn").prop("disabled", isLoading);
  $("#refreshFacetsBtn").prop("disabled", isLoading);
  $("#refreshFacetsBtnTop").prop("disabled", isLoading);

  $prevPageBtn.prop("disabled", isLoading || appState.pageIndex === 0);
  $nextPageBtn.prop("disabled", isLoading);

  if (isLoading) showSpinner();
  else hideSpinner();
}

// Debounce utility
function debounce(fn, ms = 250) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
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

// Safe money formatter
function formatMoney(amount, locale = "en-US", currencyCode = "USD") {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode }).format(n);
}

// Toast notifications (Bootstrap 4-ish markup)
function toast(message, type = "info") {
  const id = `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const headerClass =
    type === "error" ? "bg-danger text-white" :
      type === "success" ? "bg-success text-white" :
        "bg-dark text-white";

  const html = `
    <div class="toast" id="${id}" role="alert" aria-live="assertive" aria-atomic="true" data-delay="3500" style="min-width: 280px;">
      <div class="toast-header ${headerClass}">
        <strong class="mr-auto">${escapeHtml(type.toUpperCase())}</strong>
        <button type="button" class="ml-2 mb-1 close text-white" data-dismiss="toast" aria-label="Close">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      <div class="toast-body">${escapeHtml(message)}</div>
    </div>
  `;
  $("#toastHost").append(html);
  const $t = $(`#${id}`);
  $t.toast("show");
  $t.on("hidden.bs.toast", () => $t.remove());
}

// Copy helper
async function copyText(text) {
  try {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    toast("Copied to clipboard.", "success");
  } catch {
    toast("Failed to copy.", "error");
  }
}

// =========================
// Vehicle card (more scannable + details toggle + copy buttons)
// =========================
function appendVehicleCard(row) {
  const v = (val) => escapeHtml(val === null || val === undefined || val === "" ? "—" : String(val));

  const lot = row;
  const veh = row.Vehicle || row.vehicle || {};
  const make = veh.make || {};
  const model = veh.model || {};
  const se = row.SaleEvent || {};
  const yard = (se && se.Yard) || {};
  const loc = (yard && yard.Location) || {};
  const outcome = row.SaleLotOutcome || {};

  const highBid = outcome.high_bid_amount ?? outcome.high_bid_raw ?? null;

  const title =
    `${veh.year ?? ""} ${make.make_name ?? ""} ${model.model_name ?? model.model_code ?? ""} ${veh.trim ?? ""}`.trim() || "Vehicle";

  const thumbSrcRaw = veh.image_thumbnail_url || veh.image_url || "";
  const thumbSrc = thumbSrcRaw
    ? String(thumbSrcRaw).startsWith("http") ? thumbSrcRaw : `https://${thumbSrcRaw}`
    : "";

  const openImageHref = veh.image_url && String(veh.image_url).startsWith("http") ? veh.image_url : "";

  const lotIdSafe = String(lot.sale_lot_id ?? "x").replace(/[^a-zA-Z0-9_-]/g, "_");
  const detailsId = `details_${lotIdSafe}_${Math.random().toString(16).slice(2)}`;

  const imgHtml = thumbSrc
    ? `<div class="vehicle-thumb-wrap">
         <img class="vehicle-thumb" alt="Vehicle thumbnail" src="${escapeHtml(thumbSrc)}" loading="lazy" />
       </div>`
    : `<div class="vehicle-thumb-wrap vehicle-thumb-empty">
         <div class="text-muted small">No image</div>
       </div>`;

  const html = `
    <div class="col-12 col-xl-10 mb-4">
      <div class="card vehicle-card" style="border-radius: 12px; border: 1px solid rgba(0,0,0,.08); box-shadow: 0 2px 10px rgba(0,0,0,.04);">
        <div class="card-header bg-white" style="border-top-left-radius: 12px; border-top-right-radius: 12px;">
          <div class="d-flex flex-wrap justify-content-between align-items-start">
            <div class="pr-3">
              <a href="/vehicle/${escapeHtml(veh.vehicle_id)}"><h5 class="mb-1" style="font-weight:700;">${escapeHtml(title)}</h5></a>
              <div class="medium text-muted">
                <span class="mr-2">Sale: <span class="mono">${v(se.sale_date)} ${v(se.sale_time)} ${v(se.time_zone)}</span></span>
                <span class="mr-2">Lot: <span class="mono">${v(lot.lot_number)}</span></span>
                <span>VIN: <span class="mono">${v(veh.vin)}</span></span>
              </div>

              <div class="mt-2 d-flex flex-wrap align-items-center">
                <span class="badge badge-success mr-2 mb-1 p-2">High Bid: ${v(formatMoney(highBid))}</span>
                <span class="badge badge-secondary mr-2 mb-1 p-2">Mileage: ${v(lot.odometer)}</span>
                <span class="badge badge-light border mr-2 mb-1 p-2">${v(yard.yard_name)} (${v(yard.yard_number)})</span>
                <span class="badge badge-secondary mr-2 mb-1 p-2">${v(loc.state)}</span>
              </div>
            </div>

            <div class="mt-2 mt-md-0">
              <button class="btn btn-outline-secondary btn-sm mr-1" type="button" data-copy="${escapeHtml(veh.vin ?? "")}">Copy VIN</button>
              <button class="btn btn-outline-secondary btn-sm mr-1" type="button" data-copy="${escapeHtml(String(lot.lot_number ?? ""))}">Copy Lot</button>
              ${openImageHref
      ? `<a class="btn btn-outline-dark btn-sm" href="${escapeHtml(openImageHref)}" target="_blank" rel="noopener">Open Image</a>`
      : ""
    }
            </div>
          </div>
        </div>

        <div class="card-body">
          <div class="row">
            <div class="col-12 col-md-4 mb-3">
              <div class="vehicle-thumb-wrap" style="width:100%; max-width:260px; border-radius:12px; overflow:hidden; border:1px solid rgba(0,0,0,.08); background:#f8f9fa;">
                ${imgHtml}
              </div>
              <div class="mt-2 small text-muted">
                Location: ${v(loc.city)}, ${v(loc.state)} ${v(loc.zip)} • ${v(loc.country)}
              </div>
            </div>

            <div class="col-12 col-md-8">
              <div class="d-flex flex-wrap">
                <div class="mr-3 mb-2"><div class="small text-muted">Year</div><div class="font-weight-bold">${v(veh.year)}</div></div>
                <div class="mr-3 mb-2"><div class="small text-muted">Body Style</div><div class="font-weight-bold">${v(veh.body_style)}</div></div>
                <div class="mr-3 mb-2"><div class="small text-muted">Color</div><div class="font-weight-bold">${v(veh.exterior_color)}</div></div>
                <div class="mr-3 mb-2"><div class="small text-muted">Fuel</div><div class="font-weight-bold">${v(veh.fuel_type)}</div></div>
                <div class="mr-3 mb-2"><div class="small text-muted">Transmission</div><div class="font-weight-bold">${v(veh.transmission)}</div></div>
              </div>

              <div class="mt-2">
                <div class="d-flex flex-wrap">
                  <div class="mr-4 mb-2">
                    <div class="small text-muted">Retail Value</div>
                    <div class="font-weight-bold">${v(formatMoney(outcome.estimated_retail_value))}</div>
                  </div>
                  <div class="mr-4 mb-2">
                    <div class="small text-muted">Repair Cost</div>
                    <div class="font-weight-bold">${v(formatMoney(outcome.repair_cost))}</div>
                  </div>
                  <div class="mr-4 mb-2">
                    <div class="small text-muted">Buy It Now</div>
                    <div class="font-weight-bold">${v(formatMoney(outcome.buy_it_now_price))}</div>
                  </div>
                  <div class="mb-2">
                    <div class="small text-muted">Offer Eligible</div>
                    <div class="font-weight-bold">${outcome.make_an_offer_eligible === true
      ? "Yes"
      : outcome.make_an_offer_eligible === false
        ? "No"
        : "—"
    }</div>
                  </div>
                </div>
              </div>

              <div class="mt-3">
                <button class="btn btn-link px-0" id="toggleDetailsBtn" type="button" data-collapse-target="${detailsId}">
                  More Info
                </button>
                <div class="collapse" id="${detailsId}">
                  <div class="card card-body bg-light border-0">
                    <div class="small">
                      <div><span class="text-muted">Model Details:</span> <strong>${v(veh.model_details)}</strong></div>
                      <div><span class="text-muted">Engine:</span> <strong>${v(veh.engine_size)}</strong></div>
                      <div><span class="text-muted">Drivetrain:</span> <strong>${v(veh.drivetrain)}</strong></div>
                      <div><span class="text-muted">Cylinders:</span> <strong>${v(veh.cylinders)}</strong></div>
                      <div class="mt-2"><span class="text-muted">Special Note:</span><br/> <strong>${v(outcome.special_note)}</strong></div>
                      <div class="mt-2 text-muted">
                        Lot Created: ${v(formatTimestamp(lot.created_at_source))} • Lot Updated: ${v(formatTimestamp(lot.last_updated_at_source))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  $resultsDiv.append(html);
}

  $(document).on("click", "button[data-collapse-target]", function () {
    const id = $(this).attr("data-collapse-target");
    $(`#${id}`).collapse("toggle");
  });

// Delegate copy buttons
$(document).on("click", "button[data-copy]", async function () {
  const text = $(this).attr("data-copy");
  await copyText(text);
});



// =========================
// Selectize setup
// =========================
const debouncedYearsFacet = debounce(async () => {
  try {
    await refreshYearsFacet();
  } catch (e) {
    console.error(e);
    $yearsFacet.text("Error loading years.");
    toast("Failed to load years facet.", "error");
  }
}, 300);

const makesSelectize = $("#makesSelect").selectize({
  plugins: ["remove_button"],
  maxItems: null,
  valueField: "make_id",
  labelField: "make_name",
  searchField: ["make_name", "make_code"],
  placeholder: "Select makes...",
  onChange: async function () {
    try {
      await refreshModelsFacet();
      debouncedYearsFacet();
      updateSelectedSummary();
      renderActiveFilterChips();
    } catch (e) {
      console.error(e);
      toast(e.message || String(e), "error");
    }
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
    debouncedYearsFacet();
    updateSelectedSummary();
    renderActiveFilterChips();
  },
})[0].selectize;

// =========================
// Facet loading
// =========================
async function loadMakesFacet() {
  setStatus("Loading makes...");
  const res = await fetch("/api/makes");
  if (!res.ok) throw new Error(`Failed to load makes: ${res.status}`);
  const data = await res.json();

  const makes = Array.isArray(data) ? data : data.results ?? data.makes ?? [];

  makesSelectize.clearOptions();
  makesSelectize.addOption(makes);
  makesSelectize.refreshOptions(false);

  setStatus(`Loaded ${makes.length} makes.`);
}

async function refreshModelsFacet() {
  const makeIds = parseMultiValues(makesSelectize);

  if (makeIds.length === 0) {
    modelsSelectize.clear(true);
    modelsSelectize.clearOptions();
    modelsSelectize.refreshOptions(false);
    return;
  }

  setStatus("Loading models...");
  modelsSelectize.disable();

  try {
    const url = "/api/models" + buildQuery({ makeId: makeIds });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load models: ${res.status}`);
    const data = await res.json();
    const models = Array.isArray(data) ? data : data.results ?? data.models ?? [];

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
  } finally {
    modelsSelectize.enable();
  }
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

  // Flexible parsing: support either {data:{buckets}} or {buckets}
  const buckets = data?.data?.buckets ?? data?.buckets ?? [];

  const yearSet = new Set();
  for (const b of buckets) {
    const years = (b?.values ?? b?.years ?? [])
      .map((x) => Number(x?.key ?? x))
      .filter((n) => Number.isFinite(n));
    years.forEach((y) => yearSet.add(y));
  }

  const unionYears = Array.from(yearSet).sort((a, b) => a - b);

  if (unionYears.length === 0) {
    $yearsFacet.text("No years found for current filters.");
  } else {
    const minY = unionYears[0];
    const maxY = unionYears[unionYears.length - 1];
    $yearsFacet.text(`${minY} → ${maxY} (${unionYears.length} distinct years)`);
  }

  setStatus("Years facet updated.");
}

$("#toggleAdvancedBtn").on("click", function () {
  $("#advancedFilters").collapse("toggle");
});

// =========================
// Active filter chips
// =========================
function chip(label, onRemove) {
  const id = `chip_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  // remove via delegated click handler
  $(document).off("click", `#${id} button`).on("click", `#${id} button`, onRemove);
  return `
    <span class="badge badge-light border mr-2 mb-2 p-2" id="${id}">
      ${escapeHtml(label)}
      <button type="button" class="ml-2 close" aria-label="Remove" style="font-size: 16px; line-height: 1;">
        <span aria-hidden="true">&times;</span>
      </button>
    </span>
  `;
}

function renderActiveFilterChips() {
  const makeIds = parseMultiValues(makesSelectize);
  const modelIds = parseMultiValues(modelsSelectize);

    // NEW multi filters
  const locationStates = parseMultiValues(statesSelectize);
  const saleStatuses = parseMultiValues(saleStatusesSelectize);
  const runsDrives = parseMultiValues(runsDrivesSelectize);
  const titleTypes = parseMultiValues(titleTypesSelectize);

  // NEW scalar filters
  const saleDateFrom = normalizeDateInput($saleDateFrom.val());
  const saleDateTo = normalizeDateInput($saleDateTo.val());

  const odometerMin = safeNum($odometerMin.val());
  const odometerMax = safeNum($odometerMax.val());

  const highBidMin = safeNum($highBidMin.val());
  const highBidMax = safeNum($highBidMax.val());

  const buyItNowMin = safeNum($buyItNowMin.val());
  const buyItNowMax = safeNum($buyItNowMax.val());

  const trim = String($trimQuery.val() ?? "").trim();


  const fromYear = safeNum($("#fromYear").val());
  const toYear = safeNum($("#toYear").val());
  const vin = String($("#vinQuery").val() ?? "").trim();

  const onlyWithImages = $onlyWithImages.is(":checked");
  const onlyOfferEligible = $onlyOfferEligible.is(":checked");
  const onlyHasBid = $onlyHasBid.is(":checked");

  const parts = [];

  if (makeIds.length) {
    parts.push(chip(`${makeIds.length} Make(s) selected`, () => {
      makesSelectize.clear(true);
      modelsSelectize.clear(true);
      modelsSelectize.clearOptions();
      renderActiveFilterChips();
      updateSelectedSummary();
    }));
  }

  if (modelIds.length) {
    parts.push(chip(`${modelIds.length} Model(s) selected`, () => {
      modelsSelectize.clear(true);
      renderActiveFilterChips();
      updateSelectedSummary();
    }));
  }

    if (locationStates.length) {
    parts.push(chip(`State: ${locationStates.join(", ")}`, () => {
      statesSelectize.clear(true);
      renderActiveFilterChips();
      updateSelectedSummary();
    }));
  }

  if (saleStatuses.length) {
    parts.push(chip(`Sale Status: ${saleStatuses.join(", ")}`, () => {
      saleStatusesSelectize.clear(true);
      renderActiveFilterChips();
      updateSelectedSummary();
    }));
  }

  if (saleDateFrom || saleDateTo) {
    parts.push(chip(`Sale Date: ${saleDateFrom ?? "—"} to ${saleDateTo ?? "—"}`, () => {
      $saleDateFrom.val("");
      $saleDateTo.val("");
      renderActiveFilterChips();
      updateSelectedSummary();
    }));
  }

  if (runsDrives.length) {
    parts.push(chip(`Runs/Drives: ${runsDrives.join(", ")}`, () => {
      runsDrivesSelectize.clear(true);
      renderActiveFilterChips();
      updateSelectedSummary();
    }));
  }

  if (odometerMin != null || odometerMax != null) {
    parts.push(chip(`Odometer: ${odometerMin ?? "—"} to ${odometerMax ?? "—"}`, () => {
      $odometerMin.val("");
      $odometerMax.val("");
      renderActiveFilterChips();
      updateSelectedSummary();
    }));
  }

  if (highBidMin != null || highBidMax != null) {
    parts.push(chip(`High Bid: ${highBidMin ?? "—"} to ${highBidMax ?? "—"}`, () => {
      $highBidMin.val("");
      $highBidMax.val("");
      renderActiveFilterChips();
      updateSelectedSummary();
    }));
  }

  if (buyItNowMin != null || buyItNowMax != null) {
    parts.push(chip(`Buy It Now: ${buyItNowMin ?? "—"} to ${buyItNowMax ?? "—"}`, () => {
      $buyItNowMin.val("");
      $buyItNowMax.val("");
      renderActiveFilterChips();
      updateSelectedSummary();
    }));
  }

  if (trim) {
    parts.push(chip(`Trim: ${trim}`, () => {
      $trimQuery.val("");
      renderActiveFilterChips();
      updateSelectedSummary();
    }));
  }

  if (titleTypes.length) {
    parts.push(chip(`Title Type: ${titleTypes.join(", ")}`, () => {
      titleTypesSelectize.clear(true);
      renderActiveFilterChips();
      updateSelectedSummary();
    }));
  }


  if (fromYear || toYear) {
    parts.push(chip(`Years: ${fromYear ?? "—"} to ${toYear ?? "—"}`, () => {
      $("#fromYear").val("");
      $("#toYear").val("");
      renderActiveFilterChips();
      updateSelectedSummary();
    }));
  }

  if (vin) {
    parts.push(chip(`VIN: ${vin}`, () => {
      $("#vinQuery").val("");
      renderActiveFilterChips();
      updateSelectedSummary();
    }));
  }

  if (onlyWithImages) {
    parts.push(chip(`Only with images`, () => {
      $onlyWithImages.prop("checked", false);
      renderActiveFilterChips();
    }));
  }

  if (onlyOfferEligible) {
    parts.push(chip(`Offer eligible`, () => {
      $onlyOfferEligible.prop("checked", false);
      renderActiveFilterChips();
    }));
  }

  if (onlyHasBid) {
    parts.push(chip(`Has bid`, () => {
      $onlyHasBid.prop("checked", false);
      renderActiveFilterChips();
    }));
  }

  if (!parts.length) {
    $activeFilterChips.html(`<span class="text-muted small">—</span>`);
  } else {
    $activeFilterChips.html(parts.join(""));
  }
}

$("#clearAllFiltersLink").click(() => {
  $("#resetFiltersBtn").click();
});

// =========================
// Selected summary
// =========================
function updateSelectedSummary() {
  const makeIds = parseMultiValues(makesSelectize);
  const modelIds = parseMultiValues(modelsSelectize);
  const fromYear = safeNum($("#fromYear").val());
  const toYear = safeNum($("#toYear").val());

  const parts = [];
  parts.push(makeIds.length ? `${makeIds.length} make(s)` : "no makes");
  parts.push(modelIds.length ? `${modelIds.length} model(s)` : "no models");
  if (fromYear || toYear) parts.push(`years: ${fromYear ?? "—"} to ${toYear ?? "—"}`);

  $selectedFacetSummary.text(parts.join(" • "));
}

// =========================
// Paging + sorting state
// =========================
function setPageIndex(n) {
  appState.pageIndex = Math.max(0, Number(n) || 0);
  $pageIndicator.text(`Page ${appState.pageIndex + 1}`);
  $prevPageBtn.prop("disabled", appState.pageIndex === 0 || appState.isLoading);
}

function getOffset() {
  return appState.pageIndex * appState.limit;
}

// =========================
// Results loading
// =========================
function showEmptyState(show) {
  if (show) $emptyState.removeAttr("hidden");
  else $emptyState.attr("hidden", true);
}

$("#emptyClearVinBtn").click(() => {
  $("#vinQuery").val("");
  renderActiveFilterChips();
  updateSelectedSummary();
});
$("#emptyClearModelsBtn").click(() => {
  modelsSelectize.clear(true);
  renderActiveFilterChips();
  updateSelectedSummary();
});

async function loadResults() {
  const makeIds = parseMultiValues(makesSelectize);
  const modelIds = parseMultiValues(modelsSelectize);
    const locationStates = parseMultiValues(statesSelectize);
  const saleStatuses = parseMultiValues(saleStatusesSelectize);
  const runsDrives = parseMultiValues(runsDrivesSelectize);
  const titleTypes = parseMultiValues(titleTypesSelectize);

  const saleDateFrom = normalizeDateInput($saleDateFrom.val());
  const saleDateTo = normalizeDateInput($saleDateTo.val());

  const odometerMin = safeNum($odometerMin.val());
  const odometerMax = safeNum($odometerMax.val());

  const highBidMin = safeNum($highBidMin.val());
  const highBidMax = safeNum($highBidMax.val());

  const buyItNowMin = safeNum($buyItNowMin.val());
  const buyItNowMax = safeNum($buyItNowMax.val());

  const trim = String($trimQuery.val() ?? "").trim();


  const fromYear = safeNum($("#fromYear").val());
  const toYear = safeNum($("#toYear").val());
  const vin = String($("#vinQuery").val() ?? "").trim();

  // Advanced toggles
  const onlyWithImages = $onlyWithImages.is(":checked");
  const onlyOfferEligible = $onlyOfferEligible.is(":checked");
  const onlyHasBid = $onlyHasBid.is(":checked");

  // State-driven paging and sorting
  appState.limit = Math.min(Number($perPage.val() ?? 100), 1000);
  appState.sortBy = String($sortBy.val() ?? "saleDateDesc");

  const offset = getOffset();

  if (makeIds.length === 0) {
    toast("Select at least one make.", "error");
    return;
  }

  setLoading(true, "Loading results...");
  showEmptyState(false);

  try {
    const url =
      "/api/getVehicles" +
      buildQuery({
        limit: appState.limit,
        offset,
        makeId: makeIds,
        modelId: modelIds.length ? modelIds : null,
        fromYear,
        toYear,
        vin,
        sortBy: appState.sortBy,

        // existing toggles
        onlyWithImages: onlyWithImages ? "1" : null,
        onlyOfferEligible: onlyOfferEligible ? "1" : null,
        onlyHasBid: onlyHasBid ? "1" : null,

        // NEW filters -> must match your API param names
        locationState: locationStates.length ? locationStates : null,
        saleStatus: saleStatuses.length ? saleStatuses : null,
        saleDateFrom,
        saleDateTo,
        runsDrives: runsDrives.length ? runsDrives : null,
        odometerMin,
        odometerMax,
        highBidMin,
        highBidMax,
        buyItNowMin,
        buyItNowMax,
        trim,
        titleType: titleTypes.length ? titleTypes : null,
      });


    const r = await fetch(url);
    if (!r.ok) throw new Error(`Failed to load results: ${r.status}`);
    const payload = await r.json();

    const results = payload.results ?? [];
    const meta = payload.meta ?? null;
    appState.lastMeta = meta;

    $resultsDiv.empty();
    results.forEach(appendVehicleCard);

    // Empty state
    if (!results.length) {
      showEmptyState(true);
    }

    // Search info
    const returned = results.length;
    const totalCount = meta?.totalCount;
    const page = appState.pageIndex + 1;
    const showTotal = Number.isFinite(Number(totalCount));
    const msg = showTotal
      ? `Showing ${returned} of ${totalCount} • Page ${page} • Sort: ${appState.sortBy}`
      : `Showing ${returned} result(s) • Page ${page} • Sort: ${appState.sortBy}`;

    $searchInfo.text(msg);

    // Enable/disable next based on totalCount if present
    if (showTotal) {
      const nextOffset = (appState.pageIndex + 1) * appState.limit;
      $nextPageBtn.prop("disabled", nextOffset >= totalCount || appState.isLoading);
    } else {
      // If no totalCount, enable next if we filled the page (heuristic)
      $nextPageBtn.prop("disabled", returned < appState.limit || appState.isLoading);
    }

    setStatus("Results loaded.");
  } catch (e) {
    console.error(e);
    toast(e.message || String(e), "error");
    setStatus("Error loading results.");
  } finally {
    setLoading(false);
    $prevPageBtn.prop("disabled", appState.pageIndex === 0 || appState.isLoading);
  }
}

// =========================
// Events
// =========================
async function applyFilters(resetPage = true) {
  if (resetPage) setPageIndex(0);
  updateSelectedSummary();
  renderActiveFilterChips();
  try {
    await refreshYearsFacet();
  } catch {
    // years facet failure should not block search
  }
  await loadResults();
}

$("#applyFiltersBtn").click(async () => {
  await applyFilters(true);
});

$("#refreshFacetsBtn, #refreshFacetsBtnTop").click(async () => {
  try {
    setLoading(true, "Refreshing facets...");
    updateSelectedSummary();
    renderActiveFilterChips();
    await refreshModelsFacet();
    await refreshYearsFacet();
    setStatus("Facets refreshed.");
  } catch (e) {
    console.error(e);
    toast("Error refreshing facets.", "error");
    setStatus("Error refreshing facets.");
  } finally {
    setLoading(false);
  }
});

$("#resetFiltersBtn").click(async () => {
  makesSelectize.clear(true);
  modelsSelectize.clear(true);
  modelsSelectize.clearOptions();
  $("#fromYear").val("");
  $("#toYear").val("");
  $("#vinQuery").val("");
  $onlyWithImages.prop("checked", false);
  $onlyOfferEligible.prop("checked", false);
  $onlyHasBid.prop("checked", false);
    statesSelectize.clear(true);
  saleStatusesSelectize.clear(true);
  runsDrivesSelectize.clear(true);
  titleTypesSelectize.clear(true);

  $saleDateFrom.val("");
  $saleDateTo.val("");

  $odometerMin.val("");
  $odometerMax.val("");

  $highBidMin.val("");
  $highBidMax.val("");

  $buyItNowMin.val("");
  $buyItNowMax.val("");

  $trimQuery.val("");


  $perPage.val("100");
  $sortBy.val("saleDateDesc");

  setPageIndex(0);

  $yearsFacet.text("—");
  $selectedFacetSummary.text("—");
  $resultsDiv.empty();
  $searchInfo.text("");
  showEmptyState(false);

  renderActiveFilterChips();
  setStatus("Reset.");
});

$("#facetForm").on("submit", function (e) {
  e.preventDefault();
  $("#applyFiltersBtn").click();
});

// Paging controls
$prevPageBtn.click(async () => {
  if (appState.pageIndex === 0) return;
  setPageIndex(appState.pageIndex - 1);
  await applyFilters(false);
});

$nextPageBtn.click(async () => {
  setPageIndex(appState.pageIndex + 1);
  await applyFilters(false);
});

// Sorting / per-page changes should reset to page 1
$perPage.on("change", async () => {
  setPageIndex(0);
  await applyFilters(false);
});

$sortBy.on("change", async () => {
  setPageIndex(0);
  await applyFilters(false);
});

// Advanced toggles re-run search (no page reset)
$onlyWithImages.on("change", async () => {
  renderActiveFilterChips();
  setPageIndex(0);
  await applyFilters(false);
});
$onlyOfferEligible.on("change", async () => {
  renderActiveFilterChips();
  setPageIndex(0);
  await applyFilters(false);
});
$onlyHasBid.on("change", async () => {
  renderActiveFilterChips();
  setPageIndex(0);
  await applyFilters(false);
});

$("#locationStatesSelect, #saleStatusesSelect, #runsDrivesSelect, #titleTypesSelect").on("change", debounce(async () => {
  renderActiveFilterChips();
  setPageIndex(0);
  await applyFilters(false);
}, 250));

$("#saleDateFrom, #saleDateTo, #odometerMin, #odometerMax, #highBidMin, #highBidMax, #buyItNowMin, #buyItNowMax, #trimQuery")
  .on("change", debounce(async () => {
    renderActiveFilterChips();
    setPageIndex(0);
    await applyFilters(false);
  }, 350));


// VIN input: enter to apply
$("#vinQuery").on("keydown", async (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    await applyFilters(true);
  }
});

// Boot
(async function boot() {
  try {
    setLoading(true, "Initializing...");
    await loadMakesFacet();
    updateSelectedSummary();
    renderActiveFilterChips();
    setPageIndex(0);
    setStatus("Ready.");
  } catch (e) {
    console.error(e);
    toast("Error during initialization.", "error");
    setStatus("Error during initialization.");
  } finally {
    setLoading(false);
  }
})();
