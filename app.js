(() => {
  "use strict";

  const PHASES = [
    "Continuation After Breakout",
    "Range During Continuation After Breakout",
    "Retracement After Breakout",
    "Range During Retracement After Breakout",
    "Continuation After Retracement",
    "Range During Continuation After Retracement"
  ];
  const MODELS = ["Model 1", "Model 2", "Model 3", "Model 4"];
  const OUTCOMES = ["Missed", "Win", "Loss", "Never Reached Zone"];
  const STORAGE_KEY = "fieldnotes.trading-journal.v1";
  const $ = (id) => document.getElementById(id);
  const form = $("record-form");
  const filters = ["pair", "timeframe", "direction", "phase", "poi", "liquidity", "model", "model3-retracement", "model4-liquidity", "model4-level", "outcome"];
  let data = loadData();
  let dataset = "real";

  function loadData() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"real":[],"backtest":[]}');
      return {
        real: Array.isArray(parsed.real) ? parsed.real : [],
        backtest: Array.isArray(parsed.backtest) ? parsed.backtest : []
      };
    } catch (error) {
      console.error("Could not load the saved journal from this browser.", error);
      return { real: [], backtest: [] };
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Could not save the journal to this browser.", error);
      window.alert("Your browser could not save this setup. Check available storage and try again.");
      return false;
    }
    return true;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function percent(part, total) {
    return total ? `${Math.round((part / total) * 1000) / 10}%` : "0%";
  }

  function meanR(records) {
    const values = records.filter((record) => Number.isFinite(record.resultR)).map((record) => record.resultR);
    if (!values.length) return "—";
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    return `${average.toFixed(2)}R`;
  }

  function fillSelect(select, values, firstLabel) {
    const previous = select.value;
    select.innerHTML = `<option value="">${escapeHtml(firstLabel)}</option>` +
      values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
    if (values.includes(previous)) select.value = previous;
  }

  function populateStaticOptions() {
    $("phase").innerHTML = PHASES.map((phase) => `<option>${escapeHtml(phase)}</option>`).join("");
    $("filter-phase").innerHTML = `<option value="">All phases</option>` +
      PHASES.map((phase) => `<option>${escapeHtml(phase)}</option>`).join("");
  }

  function renderCounts() {
    $("real-count").textContent = data.real.length;
    $("backtest-count").textContent = data.backtest.length;
    $("list-count").textContent = `${data[dataset].length} ${data[dataset].length === 1 ? "record" : "records"}`;
  }

  function toggleConditionalFields() {
    const timeframe = $("timeframe").value;
    const model = $("model").value;
    const entered = timeframe === "15M" && ["Win", "Loss"].includes($("outcome").value);
    $("phase-field").classList.toggle("hidden", timeframe !== "15M");
    $("poi-label").textContent = `${timeframe} POI type`;
    $("liquidity-label").textContent = `${timeframe} liquidity type`;
    $("model-3-fields").classList.toggle("hidden", timeframe !== "15M" || model !== "Model 3");
    $("model-4-fields").classList.toggle("hidden", timeframe !== "15M" || model !== "Model 4");
    $("excursion-fields").classList.toggle("hidden", !entered);
    $("r-field").classList.toggle("hidden", !entered);
    $("entry-hint").textContent = model === "Model 1"
      ? "Tap the predefined POI level, then enter immediately. No MSS required."
      : model === "Model 2"
        ? "Required sequence: POI → required liquidity taken → MSS → enter."
        : model === "Model 3"
          ? "Longest wick inside the zone → following candle(s) engulf → enter; retrace to the engulfed candle head only if selected."
          : "Required sequence: POI → confirmation/MSS → retracement to the selected level → enter.";
  }

  function detailFor(record) {
    if (record.timeframe !== "15M") return "";
    if (record.model === "Model 3") return `Retracement: ${record.model3Retracement}`;
    if (record.model === "Model 4") return `Liquidity: ${record.confirmationLiquidity} · Level: ${record.retracementLevel}`;
    return "";
  }

  function renderRecords() {
    const records = [...data[dataset]].sort((a, b) => b.createdAt - a.createdAt);
    $("list-count").textContent = `${records.length} ${records.length === 1 ? "record" : "records"}`;
    if (!records.length) {
      $("records-list").innerHTML = `<div class="empty-state">No ${dataset === "real" ? "real trades" : "backtest setups"} yet. Start with one structured setup above.</div>`;
      return;
    }
    $("records-list").innerHTML = records.map((record) => {
      const context = [record.timeframe, record.direction, record.phase, record.poi, record.liquidity, record.model, detailFor(record)]
        .filter(Boolean).join(" · ");
      const outcomeClass = record.outcome === "Win" ? "outcome-win" : record.outcome === "Loss" ? "outcome-loss" : record.outcome === "Missed" ? "outcome-missed" : "";
      return `<article class="record-card">
        <div class="record-main">
          <div class="record-title"><span class="record-pair">${escapeHtml(record.pair)}</span><span class="tag">${escapeHtml(record.timeframe)}</span><span class="tag ${outcomeClass}">${escapeHtml(record.outcome)}</span>${Number.isFinite(record.resultR) ? `<span class="tag">${escapeHtml(record.resultR)}R</span>` : ""}</div>
          <div class="record-details">${escapeHtml(context)}</div>
        </div>
        <div class="record-actions"><button class="icon-button" type="button" data-action="edit" data-id="${escapeHtml(record.id)}">Edit</button><button class="icon-button" type="button" data-action="delete" data-id="${escapeHtml(record.id)}">Delete</button></div>
      </article>`;
    }).join("");
  }

  function matchingRecords(options = {}) {
    const selected = Object.fromEntries(filters.map((key) => [key, $(`filter-${key}`).value]));
    const ignoreModelDetails = options.ignoreModelDetails === true;
    const ignoreModel = options.ignoreModel === true;
    const ignorePhase = options.ignorePhase === true;
    return data[dataset].filter((record) => {
      if (selected.pair && record.pair !== selected.pair) return false;
      if (selected.timeframe && record.timeframe !== selected.timeframe) return false;
      if (selected.direction && record.direction !== selected.direction) return false;
      if (!ignorePhase && selected.phase && record.phase !== selected.phase) return false;
      if (selected.poi && record.poi !== selected.poi) return false;
      if (selected.liquidity && record.liquidity !== selected.liquidity) return false;
      if (!ignoreModel && selected.model && record.model !== selected.model) return false;
      if (selected.outcome && record.outcome !== selected.outcome) return false;
      if (!ignoreModelDetails && selected["model3-retracement"] && record.model3Retracement !== selected["model3-retracement"]) return false;
      if (!ignoreModelDetails && selected["model4-liquidity"] && record.confirmationLiquidity !== selected["model4-liquidity"]) return false;
      if (!ignoreModelDetails && selected["model4-level"] && record.retracementLevel !== selected["model4-level"]) return false;
      if (selected.timeframe === "15M" && record.timeframe !== "15M") return false;
      if (selected.timeframe === "4H" && record.timeframe !== "4H") return false;
      return true;
    });
  }

  function groupBy(records, key) {
    return records.reduce((groups, record) => {
      const value = record[key] || "—";
      (groups[value] ||= []).push(record);
      return groups;
    }, {});
  }

  function summaryCells(records) {
    const wins = records.filter((record) => record.outcome === "Win").length;
    const losses = records.filter((record) => record.outcome === "Loss").length;
    const missed = records.filter((record) => record.outcome === "Missed").length;
    const neverReached = records.filter((record) => record.outcome === "Never Reached Zone").length;
    return { wins, losses, missed, neverReached, avgR: meanR(records) };
  }

  function outcomeCells(records) {
    const { wins, losses, missed, neverReached, avgR } = summaryCells(records);
    return `<td><strong>${records.length}</strong></td><td>${wins}</td><td>${percent(wins, records.length)}</td><td>${losses}</td><td>${percent(losses, records.length)}</td><td>${missed}</td><td>${neverReached}</td><td>${avgR}</td>`;
  }

  function renderCombinationTable(records) {
    const timeframe = $("filter-timeframe").value;
    const keys = timeframe === "4H"
      ? ["pair", "direction", "poi", "liquidity", "model"]
      : timeframe === "15M"
        ? ["pair", "direction", "phase", "poi", "liquidity", "model"]
        : ["pair", "timeframe", "direction", "phase", "poi", "liquidity", "model"];
    const labels = { pair: "Pair", timeframe: "TF", direction: "4H direction", phase: "15M phase", poi: "POI", liquidity: "Liquidity", model: "Entry model" };
    $("combination-head").innerHTML = `<tr>${keys.map((key) => `<th>${labels[key]}</th>`).join("")}<th>Frequency</th><th>Wins</th><th>Win %</th><th>Losses</th><th>Loss %</th><th>Missed</th><th>Never reached</th><th>Average R</th></tr>`;
    const groups = Object.values(records.reduce((result, record) => {
      const parts = keys.map((key) => key === "phase" || key === "timeframe" ? (record[key] || "—") : record[key]);
      const signature = parts.join("\u0000");
      (result[signature] ||= { values: parts, records: [] }).records.push(record);
      return result;
    }, {}));
    groups.sort((a, b) => b.records.length - a.records.length || a.values.join("").localeCompare(b.values.join("")));
    $("combination-body").innerHTML = groups.length ? groups.map((group) => {
      const { wins, losses, avgR } = summaryCells(group.records);
      const { missed, neverReached } = summaryCells(group.records);
      return `<tr>${group.values.map((value) => `<td class="combination-cell" title="${escapeHtml(value)}">${escapeHtml(value)}</td>`).join("")}<td><strong>${group.records.length}</strong></td><td>${wins}</td><td>${percent(wins, group.records.length)}</td><td>${losses}</td><td>${percent(losses, group.records.length)}</td><td>${missed}</td><td>${neverReached}</td><td>${avgR}</td></tr>`;
    }).join("") : `<tr><td colspan="${keys.length + 8}" class="empty-state">No matching combinations.</td></tr>`;
  }

  function renderModelAnalysis() {
    const comparisonRecords = matchingRecords({ ignoreModel: true, ignoreModelDetails: true });
    $("model-body").innerHTML = MODELS.map((model) => {
      const subset = comparisonRecords.filter((record) => record.model === model);
      return `<tr><td><button class="drill-button" type="button" data-drill-model="${model}">${model}</button></td>${outcomeCells(subset)}</tr>`;
    }).join("");
  }

  function renderModelDetailAnalysis() {
    const is15M = $("filter-timeframe").value === "15M";
    const selectedModel = $("filter-model").value;
    $("model3-analysis").classList.toggle("hidden", !is15M || (selectedModel && selectedModel !== "Model 3"));
    $("model4-analysis").classList.toggle("hidden", !is15M || (selectedModel && selectedModel !== "Model 4"));
    const baseRecords = matchingRecords({ ignoreModelDetails: true });

    const model3 = baseRecords.filter((record) => record.model === "Model 3");
    $("model3-body").innerHTML = ["Yes", "No"].map((choice) => {
      const subset = model3.filter((record) => record.model3Retracement === choice);
      return `<tr><td><button class="drill-button" type="button" data-drill-model3="${choice}">${choice}</button></td>${outcomeCells(subset)}</tr>`;
    }).join("");

    const model4 = baseRecords.filter((record) => record.model === "Model 4");
    $("model4-liquidity-body").innerHTML = ["Yes", "No"].map((choice) => {
      const subset = model4.filter((record) => record.confirmationLiquidity === choice);
      return `<tr><td><button class="drill-button" type="button" data-drill-model4-liquidity="${choice}">${choice}</button></td>${outcomeCells(subset)}</tr>`;
    }).join("");
    const levels = ["OB", "Source Candle", "Mitigation Block", "FVG", "IFVG", "MSS Origin", "Other"];
    $("model4-level-body").innerHTML = ["Yes", "No"].flatMap((liquidity) => levels.map((level) => {
      const subset = model4.filter((record) => record.confirmationLiquidity === liquidity && record.retracementLevel === level);
      return `<tr><td>${liquidity}</td><td><button class="drill-button" type="button" data-drill-model4-liquidity="${liquidity}" data-drill-model4-level="${escapeHtml(level)}">${level}</button></td>${outcomeCells(subset)}</tr>`;
    })).join("");
  }

  function mix(records, key) {
    const groups = groupBy(records, key);
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length).map(([name, items]) => `${name} (${items.length})`).join(", ") || "—";
  }

  function renderPhaseAnalysis(records) {
    if ($("filter-timeframe").value !== "15M") {
      $("phase-body").innerHTML = `<tr><td colspan="12" class="empty-state">Select 15M to view phase analysis.</td></tr>`;
      return;
    }
    const phaseRecords = matchingRecords({ ignorePhase: true }).filter((record) => record.timeframe === "15M" && record.phase);
    $("phase-body").innerHTML = PHASES.map((phase) => {
      const subset = phaseRecords.filter((record) => record.phase === phase);
      const { wins, losses, missed, neverReached, avgR } = summaryCells(subset);
      return `<tr><td class="combination-cell" title="${escapeHtml(phase)}"><strong>${escapeHtml(phase)}</strong></td><td>${subset.length}</td><td>${wins}</td><td>${percent(wins, subset.length)}</td><td>${losses}</td><td>${percent(losses, subset.length)}</td><td>${missed}</td><td>${neverReached}</td><td>${avgR}</td><td class="mix-cell" title="${escapeHtml(mix(subset, "poi"))}">${escapeHtml(mix(subset, "poi"))}</td><td class="mix-cell" title="${escapeHtml(mix(subset, "liquidity"))}">${escapeHtml(mix(subset, "liquidity"))}</td><td class="mix-cell" title="${escapeHtml(mix(subset, "model"))}">${escapeHtml(mix(subset, "model"))}</td></tr>`;
    }).join("");
  }

  function renderExcursionTable(records, kind) {
    const entered = records.filter((record) => record.timeframe === "15M" && ["Win", "Loss"].includes(record.outcome));
    const body = $(kind === "sl" ? "sl-body" : "tp-body");
    const thresholds = [25, 50, 75, 100];
    body.innerHTML = thresholds.map((threshold) => {
      const reached = entered.filter((record) => threshold === 100
        ? record.outcome === (kind === "sl" ? "Loss" : "Win")
        : record[`${kind}${threshold}`] === true);
      const wins = reached.filter((record) => record.outcome === "Win").length;
      const losses = reached.filter((record) => record.outcome === "Loss").length;
      if (kind === "sl") {
        const winCell = threshold === 100 ? "—" : `${wins} (${percent(wins, reached.length)})`;
        const lossCell = threshold === 100 ? `${losses} (${losses ? "100%" : "—"})` : `${losses} (${percent(losses, reached.length)})`;
        return `<tr><td><strong>${threshold}% SL</strong></td><td>${reached.length}</td><td>${winCell}</td><td>${lossCell}</td></tr>`;
      }
      const tpCell = threshold === 100 ? `${wins} (${wins ? "100%" : "—"})` : `${wins} (${percent(wins, reached.length)})`;
      const notReachedCell = threshold === 100 ? "—" : `${losses} (${percent(losses, reached.length)})`;
      return `<tr><td><strong>${threshold}% TP</strong></td><td>${reached.length}</td><td>${tpCell}</td><td>${notReachedCell}</td></tr>`;
    }).join("");
  }

  function updateModelFilterVisibility() {
    const model = $("filter-model").value;
    const is15M = $("filter-timeframe").value === "15M";
    $("filter-model3-wrap").classList.toggle("hidden", !is15M || (model && model !== "Model 3"));
    $("filter-model4-liquidity-wrap").classList.toggle("hidden", !is15M || (model && model !== "Model 4"));
    $("filter-model4-level-wrap").classList.toggle("hidden", !is15M || (model && model !== "Model 4"));
  }

  function renderAnalytics() {
    const records = matchingRecords();
    const { wins, losses, missed, neverReached } = summaryCells(records);
    $("stat-occurrences").textContent = records.length;
    $("stat-wins").innerHTML = `${wins} <em>(${percent(wins, records.length)})</em>`;
    $("stat-losses").innerHTML = `${losses} <em>(${percent(losses, records.length)})</em>`;
    $("stat-average-r").textContent = meanR(records);
    $("outcome-breakdown").innerHTML = OUTCOMES.map((outcome) => {
      const count = outcome === "Missed" ? missed : outcome === "Win" ? wins : outcome === "Loss" ? losses : neverReached;
      return `<article class="outcome-card"><span>${escapeHtml(outcome)}</span><strong>${count}</strong><small>${percent(count, records.length)} of records</small></article>`;
    }).join("");
    renderCombinationTable(records);
    renderModelAnalysis();
    renderModelDetailAnalysis();
    renderPhaseAnalysis(records);
    renderExcursionTable(records, "sl");
    renderExcursionTable(records, "tp");
    $("analytics-empty").classList.toggle("hidden", records.length !== 0);
  }

  function refreshAnalyticsFilters() {
    const pairs = [...new Set(data[dataset].map((record) => record.pair))].sort();
    fillSelect($("filter-pair"), pairs, "All pairs");
    const phaseFilter = $("filter-phase");
    const selectedPhase = phaseFilter.value;
    phaseFilter.innerHTML = `<option value="">All phases</option>` + PHASES.map((phase) => `<option>${escapeHtml(phase)}</option>`).join("");
    if (PHASES.includes(selectedPhase)) phaseFilter.value = selectedPhase;
    updateModelFilterVisibility();
  }

  function render() {
    renderCounts();
    renderRecords();
    refreshAnalyticsFilters();
    renderAnalytics();
  }

  function collectRecord() {
    const timeframe = $("timeframe").value;
    const model = $("model").value;
    const outcome = $("outcome").value;
    const existingId = $("record-id").value;
    const previous = existingId ? data[dataset].find((record) => record.id === existingId) : null;
    const entered = timeframe === "15M" && ["Win", "Loss"].includes(outcome);
    const resultValue = $("result-r").value.trim();
    const record = {
      id: existingId || (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
      createdAt: previous ? previous.createdAt : Date.now(),
      pair: $("pair").value.trim().toUpperCase(),
      timeframe,
      direction: $("direction").value,
      phase: timeframe === "15M" ? $("phase").value : "",
      poi: $("poi").value,
      liquidity: $("liquidity").value,
      model,
      model3Retracement: timeframe === "15M" && model === "Model 3" ? $("model-3-retracement").value : "",
      confirmationLiquidity: timeframe === "15M" && model === "Model 4" ? $("confirmation-liquidity").value : "",
      retracementLevel: timeframe === "15M" && model === "Model 4" ? $("retracement-level").value : "",
      outcome,
      resultR: entered && resultValue !== "" ? Number(resultValue) : null,
      sl25: entered && form.elements.sl25.checked,
      sl50: entered && form.elements.sl50.checked,
      sl75: entered && form.elements.sl75.checked,
      tp25: entered && form.elements.tp25.checked,
      tp50: entered && form.elements.tp50.checked,
      tp75: entered && form.elements.tp75.checked
    };
    return record;
  }

  function resetForm() {
    form.reset();
    $("record-id").value = "";
    $("form-heading").textContent = "New setup";
    $("submit-label").textContent = "Save setup";
    $("cancel-edit").classList.add("hidden");
    toggleConditionalFields();
  }

  function editRecord(record) {
    $("record-id").value = record.id;
    $("pair").value = record.pair;
    $("timeframe").value = record.timeframe;
    $("direction").value = record.direction;
    $("phase").value = record.phase || PHASES[0];
    $("poi").value = record.poi;
    $("liquidity").value = record.liquidity;
    $("model").value = record.model;
    $("model-3-retracement").value = record.model3Retracement || "No";
    $("confirmation-liquidity").value = record.confirmationLiquidity || "Yes";
    $("retracement-level").value = record.retracementLevel || "OB";
    $("outcome").value = record.outcome;
    $("result-r").value = Number.isFinite(record.resultR) ? record.resultR : "";
    for (const key of ["sl25", "sl50", "sl75", "tp25", "tp50", "tp75"]) form.elements[key].checked = record[key] === true;
    $("form-heading").textContent = "Edit setup";
    $("submit-label").textContent = "Update setup";
    $("cancel-edit").classList.remove("hidden");
    toggleConditionalFields();
    $("journal-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.querySelectorAll(".dataset-button").forEach((button) => {
    button.addEventListener("click", () => {
      dataset = button.dataset.dataset;
      document.querySelectorAll(".dataset-button").forEach((item) => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      resetForm();
      filters.forEach((key) => { $(`filter-${key}`).value = key === "timeframe" ? "4H" : ""; });
      render();
    });
  });

  document.querySelectorAll(".section-tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".section-tab").forEach((item) => item.classList.toggle("active", item === button));
      document.querySelectorAll(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === button.dataset.panel));
      if (button.dataset.panel === "analytics-panel") renderAnalytics();
    });
  });

  ["timeframe", "model", "outcome"].forEach((id) => $(id).addEventListener("change", toggleConditionalFields));
  $("cancel-edit").addEventListener("click", resetForm);
  for (const kind of ["sl", "tp"]) {
    for (const threshold of [25, 50, 75]) {
      form.elements[`${kind}${threshold}`].addEventListener("change", (event) => {
        const checked = event.currentTarget.checked;
        const affected = threshold === 25 ? [50, 75] : threshold === 50 ? [75] : [];
        for (const higher of affected) {
          if (!checked) form.elements[`${kind}${higher}`].checked = false;
        }
        if (checked) {
          for (const lower of [25, 50].filter((value) => value < threshold)) {
            form.elements[`${kind}${lower}`].checked = true;
          }
        }
      });
    }
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const record = collectRecord();
    if (!record.pair) {
      $("pair").focus();
      return;
    }
    const index = data[dataset].findIndex((item) => item.id === record.id);
    if (index >= 0) data[dataset][index] = record;
    else data[dataset].push(record);
    if (persist()) {
      resetForm();
      render();
    }
  });

  $("records-list").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const record = data[dataset].find((item) => item.id === button.dataset.id);
    if (!record) return;
    if (button.dataset.action === "edit") {
      editRecord(record);
    } else if (window.confirm(`Delete the ${record.pair} ${record.timeframe} setup? This cannot be undone.`)) {
      data[dataset] = data[dataset].filter((item) => item.id !== record.id);
      if (persist()) render();
    }
  });

  filters.forEach((key) => $(`filter-${key}`).addEventListener("change", () => {
    if (key === "model") {
      if ($("filter-model").value !== "Model 3") $("filter-model3-retracement").value = "";
      if ($("filter-model").value !== "Model 4") {
        $("filter-model4-liquidity").value = "";
        $("filter-model4-level").value = "";
      }
    }
    if (key === "timeframe" && $("filter-timeframe").value !== "15M") {
      $("filter-model3-retracement").value = "";
      $("filter-model4-liquidity").value = "";
      $("filter-model4-level").value = "";
    }
    if (key === "model" || key === "timeframe") updateModelFilterVisibility();
    renderAnalytics();
  }));
  $("clear-filters").addEventListener("click", () => {
    filters.forEach((key) => { $(`filter-${key}`).value = key === "timeframe" ? "4H" : ""; });
    refreshAnalyticsFilters();
    renderAnalytics();
  });

  $("analytics-panel").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-drill-model], button[data-drill-model3], button[data-drill-model4-liquidity]");
    if (!button) return;
    if (button.dataset.drillModel) {
      $("filter-model").value = button.dataset.drillModel;
      $("filter-model3-retracement").value = "";
      $("filter-model4-liquidity").value = "";
      $("filter-model4-level").value = "";
    }
    if (button.dataset.drillModel3) {
      $("filter-model").value = "Model 3";
      $("filter-model3-retracement").value = button.dataset.drillModel3;
      $("filter-model4-liquidity").value = "";
      $("filter-model4-level").value = "";
    }
    if (button.dataset.drillModel4Liquidity) {
      $("filter-model").value = "Model 4";
      $("filter-model4-liquidity").value = button.dataset.drillModel4Liquidity;
      $("filter-model4-level").value = button.dataset.drillModel4Level || "";
      $("filter-model3-retracement").value = "";
    }
    updateModelFilterVisibility();
    renderAnalytics();
  });

  populateStaticOptions();
  toggleConditionalFields();
  render();
})();
