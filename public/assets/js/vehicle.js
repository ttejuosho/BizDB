// public/js/vehicle.js
(function ($) {
  const vehicleId = String(window.__VEHICLE_ID__ ?? "").trim();

  const $err = $("#vehicleError");
  const $title = $("#vehicleTitle");
  const $vin = $("#vehicleVin");
  const $copyVinBtn = $("#copyVinBtn");
  const $img = $("#vehicleImage");
  const $locLine = $("#vehicleLocationLine");
  const $actions = $("#vehicleActions");
  const $kv = $("#vehicleKv");
  const $saleHistory = $("#saleHistory");
  const $saleCount = $("#saleCount");

  const $vehicleCountry = $("#vehicleCountry");
  const $badges = $("#vehicleBadges");

  const $primaryLotNumber = $("#primaryLotNumber");
  const $primaryLotKv = $("#primaryLotKv");

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function money(x, currency = "USD") {
    const n = Number(x);
    if (!Number.isFinite(n)) return "—";
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
    } catch {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
    }
  }

  function showError(msg) {
    $err.text(msg).removeAttr("hidden");
  }

  async function copy(text) {
    try {
      if (!text) return;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const $ta = $("<textarea>").val(text).appendTo("body");
        $ta[0].select();
        document.execCommand("copy");
        $ta.remove();
      }
    } catch {
      // no-op
    }
  }

  function kvItem(label, valueHtml) {
    return `
      <div class="kv-item">
        <div class="kv-label">${esc(label)}</div>
        <div class="kv-value">${valueHtml}</div>
      </div>
    `;
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
  function badge(text, cls = "badge-light") {
    return `<span class="badge ${cls} mr-2 mb-2 p-2">${esc(text)}</span>`;
  }

  function getThumbUrl(primaryImage, vehicle) {
    const raw =
      primaryImage?.thumbnail_url ||
      primaryImage?.image_url ||
      vehicle?.image_thumbnail_url ||
      vehicle?.image_url ||
      "";

    if (!raw) return "";
    return String(raw).startsWith("http") ? String(raw) : `https://${raw}`;
  }

  function normalizePayload(payload) {
    const vehicle = payload?.vehicle ?? {};
    const make = payload?.make ?? vehicle?.make ?? {};
    const model = payload?.model ?? vehicle?.model ?? {};
    const images = payload?.images ?? vehicle?.VehicleImages ?? [];
    const primaryImage =
      payload?.primaryImage ??
      images.find((i) => i?.is_primary) ??
      images[0] ??
      null;

    const saleLots =
      payload?.saleLots ??
      vehicle?.SaleLots ??
      payload?.SaleLots ??
      [];

    const primaryLot = payload?.primaryLot ?? null;

    return { vehicle, make, model, images, primaryImage, saleLots, primaryLot };
  }

  function pickPrimaryLot(primaryLot, saleLots) {
    if (primaryLot) return primaryLot;
    if (!Array.isArray(saleLots) || saleLots.length === 0) return null;

    const toTs = (lot) => {
      const se = lot?.SaleEvent;
      const d = se?.sale_date ? String(se.sale_date) : "";
      const t = se?.sale_time ? String(se.sale_time) : "00:00:00";
      const ts = d ? Date.parse(`${d}T${t}`) : NaN;
      if (Number.isFinite(ts)) return ts;

      const alt = lot?.last_updated_at_source || lot?.created_at_source;
      const altTs = alt ? Date.parse(String(alt)) : NaN;
      return Number.isFinite(altTs) ? altTs : 0;
    };

    return [...saleLots].sort((a, b) => toTs(b) - toTs(a))[0] ?? null;
  }

  // Optional label helper (client-side)
  function saleTitleTypeLabel(code) {
    const c = String(code ?? "").trim().toUpperCase();
    if (!c) return "—";
    const map = {
      CT: "Clean Title",
      RT: "Rebuilt Title",
      ST: "Salvage Title",
    };
    return map[c] ? `${c} (${map[c]})` : c;
  }

  function render(payload) {
    const { vehicle, make, model, primaryImage, saleLots, primaryLot: primaryLotRaw } =
      normalizePayload(payload);

    const primaryLot = pickPrimaryLot(primaryLotRaw, saleLots);

    const pageTitle =
      `${vehicle?.year ?? ""} ${make?.make_name ?? ""} ${model?.model_name ?? model?.model_code ?? ""} ${vehicle?.trim ?? ""}`
        .trim() || "Vehicle";

    // Title
    $title.removeClass("skeleton").removeAttr("style").text(pageTitle);

    // VIN
    $vin.text(vehicle?.vin || "—");
    $copyVinBtn.off("click").on("click", async () => {
      await copy(vehicle?.vin || "");
    });

    // Country of Mfg
    $vehicleCountry.text(vehicle?.country_of_mfg ?? "—");

    // Image
    const thumb = getThumbUrl(primaryImage, vehicle);
    if (thumb) {
      $img.html(
        `<img src="${esc(thumb)}" alt="Vehicle image" style="width:100%;height:100%;object-fit:cover;" loading="lazy" />`
      );
    } else {
      $img.html(`<div class="text-muted small">No image available</div>`);
    }

    // Location line (prefer primaryLot’s location)
    const loc =
      primaryLot?.SaleEvent?.Yard?.Location ||
      saleLots?.[0]?.SaleEvent?.Yard?.Location ||
      null;

    if (loc) {
      $locLine.text(`Location: ${loc.city}, ${loc.state} ${loc.zip} • ${loc.country}`);
    } else {
      $locLine.text("Location: —");
    }

    // Actions
    const openImageHref =
      primaryImage?.image_url ||
      (vehicle?.image_url && String(vehicle.image_url).startsWith("http")
        ? vehicle.image_url
        : "");

    $actions.empty();
    if (openImageHref) {
      $actions.append(
        `<a class="btn btn-outline-dark btn-sm" href="${esc(openImageHref)}" target="_blank" rel="noopener">Open Image</a>`
      );
    }

    // Outcome/currency
    const pOutcome = primaryLot?.SaleLotOutcome || null;
    const currency = pOutcome?.currency_code || vehicle?.currency_code || "USD";

    // Badges summary
    $badges.empty();
    if (pOutcome) {
      $badges.append(badge(`High Bid: ${money(pOutcome?.high_bid_amount ?? pOutcome?.high_bid_raw, currency)}`, "badge-success"));
      $badges.append(badge(`Status: ${pOutcome?.sale_status ?? "—"}`, "badge-secondary"));
    }
    if (primaryLot?.sale_title_type) {
      $badges.append(badge(`Title: ${saleTitleTypeLabel(primaryLot.sale_title_type)}`, "badge-light"));
    }
    if (primaryLot?.has_keys) {
      $badges.append(badge(`Keys: ${primaryLot.has_keys}`, "badge-light"));
    }

    // VEHICLE KV (correct field names from your payload)
    $kv.html(
      [
        kvItem("Year", esc(vehicle?.year ?? "—")),
        kvItem("Make", esc(make?.make_name ?? make?.make_code ?? "—")),
        kvItem("Has Keys", esc(primaryLot?.has_keys ?? primaryLot?.has_keys ?? "—")),
        kvItem("Model Details", esc(vehicle?.model_details ?? "—")),
        kvItem("Trim", esc(vehicle?.trim ?? "—")),
        kvItem("Body Style", esc(vehicle?.body_style ?? "—")),
        kvItem("Exterior Color", esc(vehicle?.exterior_color ?? "—")),
        //kvItem("Interior Color", esc(vehicle?.interior_color ?? "—")),
        kvItem("Fuel Type", esc(vehicle?.fuel_type ?? "—")),
        kvItem("Transmission", esc(vehicle?.transmission ?? "—")),
        kvItem("Cylinders", esc(vehicle?.cylinders ?? "—")),
        kvItem("Engine", esc(vehicle?.engine_size ?? "—")),
        kvItem("Drivetrain", esc(vehicle?.drivetrain ?? "—")),
        kvItem("Powertrain", esc(vehicle?.powertrain ?? "—")),
        kvItem("Country of Mfg", esc(vehicle?.country_of_mfg ?? "—")),
      ].join("")
    );

    // PRIMARY LOT KV (odometer + title/keys/damage/etc live here)
    if (primaryLot) {
      $primaryLotNumber.text(primaryLot?.lot_number ?? "—");

      const se = primaryLot?.SaleEvent || {};
      const yard = se?.Yard || {};
      const l = yard?.Location || {};

      const saleLine = `${se.day_of_week ?? ""} ${se.sale_date ?? ""} ${se.sale_time ?? ""} ${se.time_zone ?? ""}`.trim() || "—";
      const yardLine = `${yard?.yard_name ?? "—"} (${yard?.yard_number ?? "—"})`;
      const locLine = l?.state ? `${l.city ?? ""}, ${l.state ?? ""} ${l.zip ?? ""}`.replace(/\s+/g, " ").trim() : "—";

      $primaryLotKv.html(
        [
          kvItem("Lot Number", `<span class="mono">${esc(primaryLot?.lot_number ?? "—")}</span>`),
          kvItem("Item #", esc(primaryLot?.item_number ?? "—")),
          kvItem("Vehicle Type", esc(primaryLot?.vehicle_type ?? "—")),
          kvItem("Mileage", esc(primaryLot?.odometer ?? "—")),
          kvItem("Title State", esc(primaryLot?.sale_title_state ?? "—")),
          kvItem("Title Type", esc(saleTitleTypeLabel(primaryLot?.sale_title_type))),
          kvItem("Has Keys", esc(primaryLot?.has_keys ?? "—")),
          kvItem("Runs/Drives", esc(primaryLot?.runs_drives ?? "—")),
          kvItem("Damage", esc(primaryLot?.damage_description ?? "—")),
          kvItem("Secondary Damage", esc(primaryLot?.secondary_damage ?? "—")),
          kvItem("Grid/Row", esc(primaryLot?.grid_row ?? "—")),
          kvItem("Sale Event", esc(saleLine)),
          kvItem("Yard", esc(yardLine)),
          kvItem("Location", esc(locLine)),
          kvItem("High Bid", esc(money(pOutcome?.high_bid_amount ?? pOutcome?.high_bid_raw, currency))),
          kvItem("Retail Value", esc(money(pOutcome?.estimated_retail_value, currency))),
          kvItem("Repair Cost", esc(money(pOutcome?.repair_cost, currency))),
          kvItem("Buy It Now", esc(money(pOutcome?.buy_it_now_price, currency))),
          kvItem("Offer Eligible", esc(pOutcome?.make_an_offer_eligible === true ? "Yes" : pOutcome?.make_an_offer_eligible === false ? "No" : "—")),
          kvItem("Special Note", esc(pOutcome?.special_note ?? "—")),
          kvItem("Lot Created", formatTimestamp(primaryLot?.created_at_source ?? "—")),
          kvItem("Lot Updated", formatTimestamp(primaryLot?.last_updated_at_source ?? "—")),
        ].join("")
      );
    } else {
      $primaryLotNumber.text("—");
      $primaryLotKv.html(`<div class="text-muted">No primary lot found.</div>`);
    }

    // Sale history
    const lots = Array.isArray(saleLots) ? saleLots : [];
    $saleCount.text(`${lots.length} lot(s)`);

    if (lots.length === 0) {
      $saleHistory.html(`<div class="text-muted">No sale history found for this vehicle.</div>`);
      return;
    }

    const rows = lots
      .map((lot) => {
        const se = lot?.SaleEvent || {};
        const yard = se?.Yard || {};
        const l = yard?.Location || {};
        const out = lot?.SaleLotOutcome || {};
        const bid = out?.high_bid_amount ?? out?.high_bid_raw ?? null;
        const ccy = out?.currency_code || "USD";

        const saleLine = `${se.day_of_week ?? ""} ${se.sale_date ?? "—"} ${se.sale_time ?? ""} ${se.time_zone ?? ""}`.trim();
        const yardLine = `${yard.yard_name ?? "—"} (${yard.yard_number ?? "—"})`;
        const locLine = l?.state ? `${l.city ?? ""}, ${l.state ?? ""}`.replace(/^,\s*/, "") : "—";

        return `
          <tr>
            <td class="mono">${esc(lot?.sale_lot_id ?? "—")}</td>
            <td class="mono">${esc(lot?.lot_number ?? "—")}</td>
            <td>${esc(saleLine || "—")}</td>
            <td>${esc(yardLine)}</td>
            <td>${esc(locLine)}</td>
            <td class="text-right">${esc(money(bid, ccy))}</td>
            <td class="text-right">${esc(money(out?.buy_it_now_price, ccy))}</td>
          </tr>
        `;
      })
      .join("");

    $saleHistory.html(`
      <div class="table-responsive">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>SaleLot ID</th>
              <th>Lot</th>
              <th>Sale</th>
              <th>Yard</th>
              <th>Location</th>
              <th class="text-right">High Bid</th>
              <th class="text-right">Buy It Now</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
  }

  async function boot() {
    if (!vehicleId) {
      showError("Missing vehicleId.");
      return;
    }

    try {
      const r = await fetch(`/api/vehicle/${encodeURIComponent(vehicleId)}`);
      if (!r.ok) throw new Error(`Failed to load vehicle: ${r.status}`);
      const payload = await r.json();
      if (payload?.error) throw new Error(payload.error);
      render(payload);
    } catch (e) {
      console.error(e);
      showError(e?.message ?? String(e));
    }
  }

  $(boot);
})(jQuery);
