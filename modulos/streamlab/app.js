/* global MOVIES */

(function () {
  /*** Estado ***/
  const state = {
    movies: [...MOVIES],
    schedule: [] // array de ids en orden
  };

  let currentActivity = null;

  /*** Helpers ***/
  const $ = (sel) => document.querySelector(sel);

  function formatUSD(n) {
    const safe = Number.isFinite(n) ? n : 0;
    return safe.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }

  function uniq(arr) {
    return [...new Set(arr)];
  }

  function countBy(arr) {
    const m = new Map();
    for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
    return m;
  }

  function movieById(id) {
    return state.movies.find(m => m.id === id);
  }

function ensureHtml2Canvas() {
  return typeof window.html2canvas === "function";
}

async function preloadImages(urls) {
  // Carga imágenes con crossOrigin para que html2canvas pueda pintarlas
  await Promise.all(
    urls.map((url) => new Promise((resolve) => {
      if (!url) return resolve();
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.referrerPolicy = "no-referrer";
      img.onload = () => resolve();
      img.onerror = () => resolve(); // no bloquea exportación si una falla
      img.src = url;
    }))
  );
}

async function saveExportRecord(user, selectedMovies, totals, activityId) {
  try {
    const db = window.db;

    if (!db) {
      console.error("Firestore no inicializado.");
      return;
    }

    const { collection, addDoc, serverTimestamp } =
      await import("https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js");

await addDoc(collection(db, "exports"), {
  userEmail: user.email,
  userUid: user.uid,
  activityId: activityId,
  timestamp: serverTimestamp(),
  totalMinutes: totals.totalMinutes,
  totalCost: totals.totalCost,
  avgRating: totals.avgRating,
  movieIds: selectedMovies.map(m => m.id),
  movieCount: selectedMovies.length
});

    console.log("Registro guardado en Firestore");

  } catch (error) {
    console.error("Error guardando registro:", error);
  }
}

async function loadActivities() {
  try {
    const db = window.db;
    if (!db) {
      console.error("Firestore no inicializado.");
      return;
    }

    const { collection, getDocs } =
      await import("https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js");

    const snapshot = await getDocs(collection(db, "activities"));

    const select = document.getElementById("activitySelect");
    if (!select) return;

    snapshot.forEach(doc => {
      const data = doc.data();

      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = data.nombre;
      select.appendChild(option);
    });

    console.log("Actividades cargadas");

  } catch (error) {
    console.error("Error cargando actividades:", error);
  }
}

  
function buildExportDom(selectedMovies, totals) {
  // Encabezado
  document.getElementById("exTotalMinutes").textContent = String(totals.totalMinutes);
  document.getElementById("exAvgRating").textContent = totals.avgRating.toFixed(2);
  document.getElementById("exTotalCost").textContent = formatUSD(totals.totalCost);

  // Grilla (máx 50 = 10x5)
  const grid = document.getElementById("exportGrid");
  grid.innerHTML = "";

  const slice = selectedMovies.slice(0, 50);
  for (const m of slice) {
    const item = document.createElement("div");
    item.className = "export-item";
    item.innerHTML = `
      <img class="export-poster" crossorigin="anonymous" referrerpolicy="no-referrer"
           src="${escapeAttr(m.posterUrl)}" alt="Poster ${escapeAttr(m.title)}" />
      <div class="export-name">${escapeHtml(m.title)}</div>
    `;
    grid.appendChild(item);
  }
}

function computeTotalsFromSelection(selectedMovies) {
  const totalMinutes = selectedMovies.reduce((acc, m) => acc + (m.minutes || 0), 0);
  const totalCost = selectedMovies.reduce((acc, m) => acc + (m.costUSD || 0), 0);
  const avgRating =
    selectedMovies.length === 0 ? 0 :
    selectedMovies.reduce((acc, m) => acc + (m.imdbRating || 0), 0) / selectedMovies.length;

  return { totalMinutes, totalCost, avgRating };
}

async function exportScheduleAsImage() {
  if (!ensureHtml2Canvas()) {
    alert("No se encontró html2canvas. Revisa que el script CDN esté cargado.");
    return;
  }

  const selectedMovies = state.schedule.map(movieById).filter(Boolean);
  if (selectedMovies.length === 0) {
    alert("Tu parrilla está vacía.");
    return;
  }

  // Renderiza el DOM de exportación
  const totals = computeTotalsFromSelection(selectedMovies);
  const user = window.firebaseUser;
  buildExportDom(selectedMovies, totals);

  // Precarga posters (ayuda a evitar imagen en blanco en el render)
  const urls = selectedMovies.slice(0, 50).map(m => m.posterUrl).filter(Boolean);
  await preloadImages(urls);

  const exportRoot = document.getElementById("exportCanvas");

  // Render a canvas
  const canvas = await window.html2canvas(exportRoot, {
    backgroundColor: "#0b1220",
    useCORS: true,
    allowTaint: false,
    scale: 2, // más resolución
    imageTimeout: 15000,
  });

if (user && currentActivity) {
  await saveExportRecord(user, selectedMovies, totals, currentActivity);
}
  
  // Descarga
  const dataUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  a.download = `parrilla_${stamp}.png`;
  a.href = dataUrl;
  a.click();
}

  /*** Render ***/
  function renderGenreSelect() {
    const allGenres = uniq(state.movies.flatMap(m => m.genres)).sort((a,b) => a.localeCompare(b));
    const select = $("#genreSelect");
    select.innerHTML = `<option value="">Todos los géneros</option>` + allGenres.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
  }

  function renderLibrary() {
    const q = ($("#searchInput").value || "").trim().toLowerCase();
    const g = $("#genreSelect").value;

    const library = $("#library");
    const filtered = state.movies.filter(m => {
      const matchesText = !q || m.title.toLowerCase().includes(q);
      const matchesGenre = !g || m.genres.includes(g);
      return matchesText && matchesGenre;
    });

    $("#libraryCountPill").textContent = `${filtered.length} película${filtered.length === 1 ? "" : "s"}`;

    library.innerHTML = filtered.map(m => libraryCardHtml(m)).join("");

    // bind drag events
    for (const el of library.querySelectorAll("[data-movie-id]")) {
      el.addEventListener("dragstart", onDragStartFromLibrary);
      el.addEventListener("dragend", onDragEnd);
    }
    // Bind botones Agregar
library.querySelectorAll("[data-add-id]").forEach(btn => {
  btn.addEventListener("click", (e) => {
    const id = e.currentTarget.getAttribute("data-add-id");

    if (!state.schedule.includes(id)) {
      state.schedule.push(id);
      renderSchedule();
      renderLibrary(); // <-- clave
    }
  });
});
  }

  function renderSchedule() {
    const scheduleEl = $("#schedule");
    $("#scheduleCountPill").textContent = `${state.schedule.length} seleccionada${state.schedule.length === 1 ? "" : "s"}`;

    if (state.schedule.length === 0) {
      scheduleEl.innerHTML = "";
      renderMetrics();
      return;
    }

    scheduleEl.innerHTML = state.schedule
      .map((id, idx) => {
        const m = movieById(id);
        return scheduleRowHtml(m, idx);
      })
      .join("");

    // Bind remove buttons
    scheduleEl.querySelectorAll("[data-remove-id]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-remove-id");
        state.schedule = state.schedule.filter(x => x !== id);
        renderSchedule();
        renderLibrary();
      });
    });

    // Enable reorder drag within schedule
    scheduleEl.querySelectorAll(".card").forEach(card => {
      card.addEventListener("dragstart", onDragStartFromSchedule);
      card.addEventListener("dragend", onDragEnd);
      card.addEventListener("dragover", onScheduleDragOver);
      card.addEventListener("drop", onScheduleDropReorder);
    });

    renderMetrics();
  }

  function renderMetrics() {
    const selected = state.schedule.map(movieById).filter(Boolean);

    const totalMinutes = selected.reduce((acc, m) => acc + (m.minutes || 0), 0);
    const totalCost = selected.reduce((acc, m) => acc + (m.costUSD || 0), 0);

    const avgRating =
      selected.length === 0 ? 0 :
      selected.reduce((acc, m) => acc + (m.imdbRating || 0), 0) / selected.length;

    $("#totalMinutes").textContent = String(totalMinutes);
    $("#totalCost").textContent = formatUSD(totalCost);
    $("#avgRating").textContent = avgRating.toFixed(2);

    // Genres (selected)
    const selectedGenres = selected.flatMap(m => m.genres || []);
    const selectedMap = countBy(selectedGenres);
    $("#selectedGenres").innerHTML = mapToPrettyLines(selectedMap) || "—";

    // Genres (all)
    const allGenres = state.movies.flatMap(m => m.genres || []);
    const allMap = countBy(allGenres);
    $("#allGenres").innerHTML = mapToPrettyLines(allMap) || "—";
  }

  function mapToPrettyLines(map) {
    if (!map || map.size === 0) return "";
    const entries = [...map.entries()].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return entries.map(([k,v]) => `<div><strong>${escapeHtml(k)}</strong>: ${v}</div>`).join("");
  }

  /*** Templates ***/
function libraryCardHtml(m) {
  const isAdded = state.schedule.includes(m.id);

  return `
    <article class="card" draggable="true" data-movie-id="${escapeAttr(m.id)}" title="Arrastra a la parrilla">
      <img class="poster" crossorigin="anonymous" src="${escapeAttr(m.posterUrl)}" alt="Poster ${escapeAttr(m.title)}" loading="lazy" />
      <div>
        <div class="card-title">${escapeHtml(m.title)} <span class="muted">(${m.year})</span></div>
        <div class="card-meta">
          <span class="tag accent">${m.minutes} min</span>
          <span class="tag ok">★ ${Number(m.imdbRating).toFixed(1)}</span>
          <span class="tag">${formatUSD(m.costUSD)}</span>
        </div>
        <div class="card-meta">
          ${(m.genres || []).slice(0, 4).map(g => `<span class="tag">${escapeHtml(g)}</span>`).join("")}
        </div>

        <button 
          class="add-btn ${isAdded ? "disabled" : ""}" 
          type="button" 
          data-add-id="${escapeAttr(m.id)}"
          ${isAdded ? "disabled" : ""}
          aria-label="Agregar">
          ${isAdded ? "✓" : "+"}
        </button>
      </div>
    </article>
  `;
}

  function scheduleRowHtml(m, idx) {
    return `
      <article class="card" draggable="true" data-schedule-index="${idx}" data-movie-id="${escapeAttr(m.id)}" title="Arrastra para reordenar">
        <img class="poster" crossorigin="anonymous" src="${escapeAttr(m.posterUrl)}" alt="Poster ${escapeAttr(m.title)}" loading="lazy" />        <div>
          <div class="card-title">${escapeHtml(m.title)} <span class="muted">(${m.year})</span></div>
          <div class="card-meta">
            <span class="tag accent">${m.minutes} min</span>
            <span class="tag ok">★ ${Number(m.imdbRating).toFixed(1)}</span>
            <span class="tag">${formatUSD(m.costUSD)}</span>
          </div>
          <div class="card-meta">
            ${(m.genres || []).slice(0, 4).map(g => `<span class="tag">${escapeHtml(g)}</span>`).join("")}
          </div>
        </div>
        <button class="icon-btn" type="button" data-remove-id="${escapeAttr(m.id)}" aria-label="Quitar">✕</button>
      </article>
    `;
  }

  /*** Drag & Drop ***/
  function onDragStartFromLibrary(e) {
    const id = e.currentTarget.getAttribute("data-movie-id");
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "library", id }));
    e.dataTransfer.effectAllowed = "copy";
    e.currentTarget.classList.add("dragging");
  }

  function onDragStartFromSchedule(e) {
    const id = e.currentTarget.getAttribute("data-movie-id");
    const index = Number(e.currentTarget.getAttribute("data-schedule-index"));
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "schedule", id, index }));
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.classList.add("dragging");
  }

  function onDragEnd(e) {
    e.currentTarget.classList.remove("dragging");
    $("#scheduleDropzone").classList.remove("over");
  }

  function onDropzoneDragOver(e) {
    e.preventDefault();
    $("#scheduleDropzone").classList.add("over");
    e.dataTransfer.dropEffect = "copy";
  }

  function onDropzoneDragLeave() {
    $("#scheduleDropzone").classList.remove("over");
  }

  function onDropzoneDrop(e) {
    e.preventDefault();
    $("#scheduleDropzone").classList.remove("over");

    const payload = safeParseJson(e.dataTransfer.getData("text/plain"));
    if (!payload || !payload.id) return;

    // Add from library OR schedule (if dropped on empty area, just append)
    if (!state.schedule.includes(payload.id)) {
      state.schedule.push(payload.id);
      renderSchedule();
      renderLibrary();
    }
  }

  // Reorder logic
  function onScheduleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onScheduleDropReorder(e) {
    e.preventDefault();
    const targetIndex = Number(e.currentTarget.getAttribute("data-schedule-index"));
    const payload = safeParseJson(e.dataTransfer.getData("text/plain"));
    if (!payload || payload.type !== "schedule") return;

    const fromIndex = payload.index;
    if (!Number.isFinite(fromIndex) || !Number.isFinite(targetIndex) || fromIndex === targetIndex) return;

    const next = [...state.schedule];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(targetIndex, 0, moved);
    state.schedule = next;
    renderSchedule();
  }

  /*** Events ***/
  function bindEvents() {
    $("#searchInput").addEventListener("input", renderLibrary);
    $("#genreSelect").addEventListener("change", renderLibrary);

    $("#clearScheduleBtn").addEventListener("click", () => {
      state.schedule = [];
      renderSchedule();
      renderLibrary();
    });

    const dz = $("#scheduleDropzone");
    dz.addEventListener("dragover", onDropzoneDragOver);
    dz.addEventListener("dragleave", onDropzoneDragLeave);
    dz.addEventListener("drop", onDropzoneDrop);
    document.getElementById("exportBtn").addEventListener("click", exportScheduleAsImage);
  
    const activitySelect = document.getElementById("activitySelect");

    activitySelect?.addEventListener("change", (e) => {
    currentActivity = e.target.value || null;
    console.log("Actividad seleccionada:", currentActivity);
});
  
  }

  /*** Safe utils ***/
  function safeParseJson(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replaceAll("`", "&#096;");
  }

  /*** Init ***/
  function init() {
    renderGenreSelect();
    bindEvents();
    renderLibrary();
    renderSchedule();
    renderMetrics();
  }

  init();
  window.loadActivities = loadActivities;
})();
