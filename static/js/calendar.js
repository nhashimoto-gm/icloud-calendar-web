const BASE = (window.CALENDAR_BASE || "/").replace(/\/+$/, "") + "/";

document.addEventListener("DOMContentLoaded", function () {
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
