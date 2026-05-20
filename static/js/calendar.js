const BASE = (window.CALENDAR_BASE || "/").replace(/\/+$/, "") + "/";

let searchDebounceTimer = null;
let searchResultEvents = [];
let lastSearchQuery = "";
let suggestionCache = null;
let suggestionsLoading = false;
let selectedSuggestionIndex = -1;

function loadSuggestions() {
  if (suggestionCache !== null || suggestionsLoading) return;
  suggestionsLoading = true;
  fetch(`${BASE}api/suggestions`)
    .then((r) => r.json())
    .then((data) => {
      suggestionCache = Array.isArray(data) ? data : [];
      suggestionsLoading = false;
      const input = document.getElementById("search-input");
      const panel = document.getElementById("search-panel");
      if (input && panel && !panel.classList.contains("hidden")) {
        showSuggestions(input.value.trim());
      }
    })
    .catch(() => { suggestionCache = []; suggestionsLoading = false; });
}

function showSuggestions(query) {
  if (!suggestionCache || suggestionCache.length === 0) return;
  const q = query.toLowerCase();
  const filtered = q
    ? suggestionCache.filter((s) => s.toLowerCase().includes(q)).slice(0, 10)
    : suggestionCache.slice(0, 10);
  const container = document.getElementById("search-suggestions");
  if (filtered.length === 0) { hideSuggestions(); return; }
  selectedSuggestionIndex = -1;
  container.innerHTML = filtered
    .map((term) => `<div class="suggestion-item" data-term="${escapeHtml(term)}">${escapeHtml(term)}</div>`)
    .join("");
  container.querySelectorAll(".suggestion-item").forEach((el) => {
    el.addEventListener("mousedown", (e) => e.preventDefault());
    el.addEventListener("click", function () { selectSuggestion(this.dataset.term); });
  });
  container.classList.remove("hidden");
}

function hideSuggestions() {
  const container = document.getElementById("search-suggestions");
  if (container) container.classList.add("hidden");
  selectedSuggestionIndex = -1;
}

function selectSuggestion(term) {
  document.getElementById("search-input").value = term;
  hideSuggestions();
  clearTimeout(searchDebounceTimer);
  doSearch();
}

function moveSuggestion(dir) {
  const items = [...document.querySelectorAll("#search-suggestions .suggestion-item")];
  if (!items.length) return;
  items[selectedSuggestionIndex]?.classList.remove("active");
  selectedSuggestionIndex = Math.max(-1, Math.min(items.length - 1, selectedSuggestionIndex + dir));
  if (selectedSuggestionIndex >= 0) {
    items[selectedSuggestionIndex].classList.add("active");
    items[selectedSuggestionIndex].scrollIntoView({ block: "nearest" });
  }
}

function toggleSearch() {
  const panel = document.getElementById("search-panel");
  panel.classList.contains("hidden") ? openSearch() : closeSearch();
}

function openSearch() {
  const headerH = document.querySelector("header").offsetHeight;
  const panel = document.getElementById("search-panel");
  panel.style.top = headerH + "px";
  panel.classList.remove("hidden");
  document.getElementById("search-overlay").classList.remove("hidden");
  document.getElementById("search-input").focus();
  loadSuggestions();
  if (suggestionCache) showSuggestions("");
}

function closeSearch() {
  document.getElementById("search-panel").classList.add("hidden");
  document.getElementById("search-overlay").classList.add("hidden");
  document.getElementById("search-input").value = "";
  document.getElementById("search-results").innerHTML = "";
  document.getElementById("search-feedback").textContent = "";
  searchResultEvents = [];
  clearTimeout(searchDebounceTimer);
  hideSuggestions();
}

function doSearch() {
  const q = document.getElementById("search-input").value.trim();
  if (!q) {
    document.getElementById("search-results").innerHTML = "";
    document.getElementById("search-feedback").textContent = "";
    showSuggestions("");
    return;
  }
  lastSearchQuery = q;
  hideSuggestions();
  document.getElementById("search-feedback").textContent = "検索中…";
  fetch(`${BASE}api/search?q=${encodeURIComponent(q)}&full=0`)
    .then((res) => res.json())
    .then((data) => {
      if (data.error) {
        document.getElementById("search-feedback").textContent = "エラー: " + data.error;
        document.getElementById("search-results").innerHTML = "";
        return;
      }
      renderSearchResults(data, q, false);
    })
    .catch(() => {
      document.getElementById("search-feedback").textContent = "検索に失敗しました";
    });
}

function doSearchFull() {
  const q = lastSearchQuery;
  if (!q) return;
  const btn = document.getElementById("search-more-btn");
  if (btn) { btn.disabled = true; btn.textContent = "検索中…"; }
  fetch(`${BASE}api/search?q=${encodeURIComponent(q)}&full=1`)
    .then((res) => res.json())
    .then((data) => {
      if (data.error) {
        document.getElementById("search-feedback").textContent = "エラー: " + data.error;
        return;
      }
      renderSearchResults(data, q, true);
    })
    .catch(() => {
      document.getElementById("search-feedback").textContent = "検索に失敗しました";
    });
}

function renderSearchResults(events, q, isFull) {
  hideSuggestions();
  searchResultEvents = events;
  const feedback = document.getElementById("search-feedback");
  const container = document.getElementById("search-results");
  const rangeLabel = isFull ? "（過去1年〜2年先）" : "（直近2ヶ月）";
  const moreBtn = isFull ? "" : `<div class="search-more-wrap">
    <button id="search-more-btn" class="search-more-btn" onclick="doSearchFull()">過去1年〜2年先も検索する</button>
  </div>`;

  if (events.length === 0) {
    feedback.textContent = `「${q}」に一致する予定はありません ${rangeLabel}`;
    container.innerHTML = moreBtn;
    return;
  }

  feedback.textContent = `${events.length} 件見つかりました ${rangeLabel}`;
  container.innerHTML = events.map((event, i) => {
    const props = event.extendedProps || {};
    const startDate = new Date(event.start);
    const dateStr = event.allDay ? formatDate(startDate) : formatDateTime(startDate);
    const meta = [
      props.calendar ? `<span>📆 ${escapeHtml(props.calendar)}</span>` : "",
      props.location ? `<span>📍 ${escapeHtml(props.location)}</span>` : "",
    ].filter(Boolean).join("");
    return `<div class="search-result-item" onclick="openSearchResult(${i})">
      <span class="search-result-dot" style="background:${escapeHtml(event.color || "#888")}"></span>
      <div class="search-result-body">
        <div class="search-result-title">${escapeHtml(event.title)}</div>
        <div class="search-result-meta"><span>📅 ${dateStr}</span>${meta}</div>
      </div>
    </div>`;
  }).join("") + moreBtn;
}

function openSearchResult(index) {
  const event = searchResultEvents[index];
  if (!event) return;
  const props = event.extendedProps || {};

  document.getElementById("modal-title").textContent = event.title;

  const startDate = new Date(event.start);
  const endDate = event.end ? new Date(event.end) : null;
  const start = event.allDay ? formatDate(startDate) : formatDateTime(startDate);
  const end = endDate
    ? event.allDay
      ? " 〜 " + formatDate(adjustAllDayEnd(endDate))
      : " 〜 " + formatDateTime(endDate)
    : "";

  document.getElementById("modal-datetime").textContent = "📅 " + start + end;
  document.getElementById("modal-calendar").textContent = props.calendar ? "📆 " + props.calendar : "";
  document.getElementById("modal-location").textContent = props.location ? "📍 " + props.location : "";
  document.getElementById("modal-description").textContent = props.description ? "📝 " + props.description : "";

  document.getElementById("event-modal").classList.remove("hidden");
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  updateThemeButton(isDark);
}

function updateThemeButton(isDark) {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  btn.textContent = isDark ? "☀ ライト" : "☾ ダーク";
}

document.addEventListener("DOMContentLoaded", function () {
  updateThemeButton(document.documentElement.classList.contains("dark"));

  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      clearTimeout(searchDebounceTimer);
      const q = this.value.trim();
      if (!q) {
        document.getElementById("search-results").innerHTML = "";
        document.getElementById("search-feedback").textContent = "";
        showSuggestions("");
        return;
      }
      showSuggestions(q);
      document.getElementById("search-feedback").textContent = "検索中…";
      searchDebounceTimer = setTimeout(doSearch, 400);
    });
    searchInput.addEventListener("keydown", function (e) {
      const sugEl = document.getElementById("search-suggestions");
      const sugVisible = !sugEl.classList.contains("hidden");
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (sugVisible) moveSuggestion(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (sugVisible) moveSuggestion(-1);
      } else if (e.key === "Enter") {
        if (sugVisible && selectedSuggestionIndex >= 0) {
          const items = sugEl.querySelectorAll(".suggestion-item");
          if (items[selectedSuggestionIndex]) selectSuggestion(items[selectedSuggestionIndex].dataset.term);
        } else {
          clearTimeout(searchDebounceTimer);
          doSearch();
        }
      } else if (e.key === "Escape") {
        closeSearch();
      }
    });
  }

  const calendarEl = document.getElementById("calendar");
  let nightExpanded = false;
  const isMobile = () => window.innerWidth < 768;

  const mobileToolbar = {
    left:   "prev,next",
    center: "title",
    right:  "dayGridMonth,listWeek",
  };
  const desktopToolbar = {
    left:   "prev,next today",
    center: "title",
    right:  "dayGridMonth,timeGridWeek,timeGridDay,listWeek toggleNight",
  };

  const calendar = new FullCalendar.Calendar(calendarEl, {
    locale: "ja",
    initialView: isMobile() ? "listWeek" : "dayGridMonth",
    headerToolbar: isMobile() ? mobileToolbar : desktopToolbar,
    buttonText: {
      today: "今日",
      month: "月",
      week:  "週",
      day:   "日",
      list:  "一覧",
    },
    customButtons: {
      toggleNight: {
        text: "深夜を展開",
        click: function () {
          nightExpanded = !nightExpanded;
          calendar.setOption("slotMinTime", nightExpanded ? "00:00:00" : "05:00:00");
          calendar.setOption("slotMaxTime", nightExpanded ? "24:00:00" : "21:00:00");
          const btn = calendarEl.querySelector(".fc-toggleNight-button");
          if (btn) btn.textContent = nightExpanded ? "深夜を折りたたむ" : "深夜を展開";
        },
      },
    },
    slotMinTime: "05:00:00",
    slotMaxTime: "21:00:00",
    slotDuration: "00:30:00",
    height: "auto",
    nowIndicator: true,
    editable: false,
    selectable: false,
    eventMinHeight: 20,
    windowResize: function () {
      calendar.setOption("headerToolbar", isMobile() ? mobileToolbar : desktopToolbar);
    },

    events: function (info, successCallback, failureCallback) {
      fetch(
        `${BASE}api/events?start=${encodeURIComponent(info.startStr)}&end=${encodeURIComponent(info.endStr)}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            showError(data.error);
            failureCallback(data.error);
          } else {
            successCallback(data);
            loadLegend();
          }
        })
        .catch((err) => {
          showError("イベントの取得に失敗しました");
          failureCallback(err);
        });
    },

    eventClick: function (info) {
      const event = info.event;
      const props = event.extendedProps;

      document.getElementById("modal-title").textContent = event.title;

      const start = event.allDay
        ? formatDate(event.start)
        : formatDateTime(event.start);
      const end = event.end
        ? event.allDay
          ? " 〜 " + formatDate(adjustAllDayEnd(event.end))
          : " 〜 " + formatDateTime(event.end)
        : "";
      document.getElementById("modal-datetime").textContent = "📅 " + start + end;

      document.getElementById("modal-calendar").textContent = props.calendar
        ? "📆 " + props.calendar
        : "";
      document.getElementById("modal-location").textContent = props.location
        ? "📍 " + props.location
        : "";
      document.getElementById("modal-description").textContent = props.description
        ? "📝 " + props.description
        : "";

      document.getElementById("event-modal").classList.remove("hidden");
      document.getElementById("modal-overlay").classList.remove("hidden");
    },

    viewDidMount: function (info) {
      const btn = calendarEl.querySelector(".fc-toggleNight-button");
      if (!btn) return;
      const isTimeGrid = info.view.type.startsWith("timeGrid");
      btn.style.display = isTimeGrid ? "" : "none";
    },
  });

  calendar.render();

  function loadLegend() {
    fetch(`${BASE}api/calendars`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) return;
        const legend = document.getElementById("calendar-legend");
        legend.innerHTML = "";
        data.forEach((cal) => {
          const item = document.createElement("div");
          item.className = "legend-item";
          item.innerHTML = `<span class="legend-dot" style="background:${cal.color}"></span>${cal.name}`;
          legend.appendChild(item);
        });
      })
      .catch(() => {});
  }

  loadLegend();
});

function closeModal() {
  document.getElementById("event-modal").classList.add("hidden");
  document.getElementById("modal-overlay").classList.add("hidden");
}

function showError(msg) {
  const bar = document.getElementById("error-bar");
  document.getElementById("error-message").textContent = msg;
  bar.classList.remove("hidden");
  setTimeout(() => bar.classList.add("hidden"), 5000);
}

function formatDate(d) {
  if (!d) return "";
  return d.getFullYear() + "年" +
    (d.getMonth() + 1) + "月" +
    d.getDate() + "日";
}

function formatDateTime(d) {
  if (!d) return "";
  return formatDate(d) + " " +
    String(d.getHours()).padStart(2, "0") + ":" +
    String(d.getMinutes()).padStart(2, "0");
}

function adjustAllDayEnd(d) {
  const adj = new Date(d);
  adj.setDate(adj.getDate() - 1);
  return adj;
}
