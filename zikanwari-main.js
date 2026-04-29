document.addEventListener("DOMContentLoaded", () => {
  const days = ["月", "火", "水", "木", "金"];
  const defaultPeriods = 8;

  const periodTimes = [
    { start: "08:50", end: "09:35" },
    { start: "09:45", end: "10:30" },
    { start: "10:40", end: "11:25" },
    { start: "11:35", end: "12:20" },
    { start: "13:20", end: "14:05" },
    { start: "14:15", end: "15:00" },
    { start: "15:10", end: "15:55" },
    { start: "16:10", end: "16:55" }
  ];

  let timetableData = {};
  let appSettings = {
    showEmpty: false,
    showTeacher: true,
    showRoom: true,
    periods: defaultPeriods,
    customHolidays: ""
  };
  let holidaysData = null;

  const tabHome = document.getElementById("tab-home");
  const tabWeek = document.getElementById("tab-week");
  const tabSettings = document.getElementById("tab-settings");

  const viewHome = document.getElementById("view-home");
  const viewWeek = document.getElementById("view-week");
  const viewSettings = document.getElementById("view-settings");

  const headerTitle = document.getElementById("header-title");

  const modal = document.getElementById("edit-modal");
  const btnCancel = document.getElementById("btn-cancel");
  const btnSave = document.getElementById("btn-save");
  const btnDelete = document.getElementById("btn-delete");

  const settingShowEmpty = document.getElementById("setting-show-empty");
  const settingShowTeacher = document.getElementById("setting-show-teacher");
  const settingShowRoom = document.getElementById("setting-show-room");
  const settingPeriods = document.getElementById("setting-periods");
  const settingApiKey = document.getElementById("setting-api-key");
  const btnClearApiKey = document.getElementById("btn-clear-api-key");
  const settingCustomHolidays = document.getElementById("setting-custom-holidays");

  const btnExport = document.getElementById("btn-export");
  const btnImport = document.getElementById("btn-import");
  const btnReset = document.getElementById("btn-reset");
  const fileImport = document.getElementById("file-import");

  const btnParsePdf = document.getElementById("btn-parse-pdf");
  const pdfUpload = document.getElementById("pdf-upload");
  const pdfStatus = document.getElementById("pdf-status");

  function getPeriods() {
    const n = Number(appSettings.periods);
    if (!Number.isFinite(n) || n < 1) return defaultPeriods;
    return Math.min(Math.max(n, 1), 8);
  }

  function createEmptyEntry() {
    return {
      subject: "",
      teacher: "",
      room: "",
      memo: "",
      color: "color-default"
    };
  }

  function initData(periodCount = getPeriods()) {
    timetableData = {};
    days.forEach(day => {
      timetableData[day] = [];
      for (let i = 0; i < periodCount; i++) {
        timetableData[day].push(createEmptyEntry());
      }
    });
  }

  function ensureDayLength(day, length) {
    if (!Array.isArray(timetableData[day])) timetableData[day] = [];
    while (timetableData[day].length < length) timetableData[day].push(createEmptyEntry());
    if (timetableData[day].length > length) timetableData[day] = timetableData[day].slice(0, length);
  }

  function ensureDataShape() {
    const p = getPeriods();
    days.forEach(day => ensureDayLength(day, p));
  }

  function loadData() {
    const saved = localStorage.getItem("gachi_timetable");
    if (!saved) {
      initData();
      return;
    }

    try {
      const parsed = JSON.parse(saved);
      timetableData = parsed && typeof parsed === "object" ? parsed : {};
      ensureDataShape();
    } catch (e) {
      console.warn("時間割データの読み込みに失敗しました。初期化します。", e);
      initData();
    }
  }

  function loadSettings() {
    const saved = localStorage.getItem("gachi_settings");
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        appSettings = { ...appSettings, ...parsed };
      }
    } catch (e) {
      console.warn("設定の読み込みに失敗しました。", e);
    }

    appSettings.periods = getPeriods();
  }

  function saveSettings() {
    localStorage.setItem("gachi_settings", JSON.stringify(appSettings));
  }

  function saveTimetable() {
    localStorage.setItem("gachi_timetable", JSON.stringify(timetableData));
  }

  function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function normalizeText(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  }

  function normalizeFullWidth(s) {
    return normalizeText(s)
      .replace(/[０-９]/g, d => String(d.charCodeAt(0) - 0xFEE0))
      .replace(/[：]/g, ":")
      .replace(/[～〜]/g, "~");
  }

  function getTodayDayStr() {
    const i = new Date().getDay();
    if (i === 0 || i === 6) return null;
    return days[i - 1];
  }

  function getCurrentPeriodIndex() {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const limit = Math.min(getPeriods(), periodTimes.length);
    for (let i = 0; i < limit; i++) {
      if (hhmm >= periodTimes[i].start && hhmm <= periodTimes[i].end) return i;
    }
    return -1;
  }

  function saveAndRefresh() {
    saveTimetable();
    modal.classList.remove("show");
    renderWeek();
    if (viewHome.classList.contains("active")) renderHome();
  }

  function getCustomHolidaysMap() {
    const map = {};
    if (!appSettings.customHolidays) return map;
    const lines = appSettings.customHolidays.split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const datePart = parts[0].replace(/\//g, '-'); // 10/21 と 10-21 の両方に対応
        const namePart = parts.slice(1).join(' ');
        map[datePart] = namePart;
      }
    }
    return map;
  }

  function renderHome() {
    const list = document.getElementById("today-list");
    list.innerHTML = "";

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const todayDateStr = `${yyyy}-${mm}-${dd}`;
    const todayMmDd = `${mm}-${dd}`;

    const customHolidaysMap = getCustomHolidaysMap();
    const holidayName = customHolidaysMap[todayDateStr] || customHolidaysMap[todayMmDd] || (holidaysData && holidaysData[todayDateStr]);

    if (holidayName) {
      list.appendChild(createEl("p", "empty-msg", `今日は授業がありません（休講：${holidayName}）。`));
      return;
    }

    const todayStr = getTodayDayStr();
    if (!todayStr) {
      list.appendChild(createEl("p", "empty-msg", "今日は授業がありません（土日）。"));
      return;
    }

    const classes = timetableData[todayStr] || [];
    const currentPeriod = getCurrentPeriodIndex();
    let hasClass = false;

    classes.forEach((cls, i) => {
      if (!cls.subject && !appSettings.showEmpty) return;
      hasClass = true;

      const card = document.createElement("div");
      card.className = `card ${cls.color || "color-default"}`;
      if (i === currentPeriod) card.classList.add("now-active");

      card.appendChild(createEl("div", "card-period", `${todayStr}曜 ${i + 1}限`));
      card.appendChild(createEl("h3", "card-subject", cls.subject || "空きコマ"));

      const details = createEl("div", "card-details");
      if (appSettings.showRoom && cls.room) details.appendChild(createEl("span", "", `📍 ${cls.room}`));
      if (appSettings.showTeacher && cls.teacher) details.appendChild(createEl("span", "", `🧑‍🏫 ${cls.teacher}`));
      card.appendChild(details);

      if (cls.memo) card.appendChild(createEl("div", "card-memo", `📝 ${cls.memo}`));
      list.appendChild(card);
    });

    if (!hasClass) {
      list.appendChild(createEl("p", "empty-msg", "今日の授業は登録されていません。"));
    }
  }

  function renderWeek() {
    const gridBody = document.getElementById("grid-body");
    gridBody.innerHTML = "";

    const todayStr = getTodayDayStr();
    const currentPeriod = getCurrentPeriodIndex();
    const p = getPeriods();

    const weekHolidays = {};
    if (holidaysData) {
      const now = new Date();
      const dayOfWeek = now.getDay();
      
      // 土日は「来週の月〜金」の祝日を判定し、平日は「今週の月〜金」を判定する
      let diffToMonday;
      if (dayOfWeek === 0) diffToMonday = 1;
      else if (dayOfWeek === 6) diffToMonday = 2;
      else diffToMonday = 1 - dayOfWeek;

      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);

      const customHolidaysMap = getCustomHolidaysMap();

      days.forEach((day, index) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + index);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const mmDd = `${mm}-${dd}`;
        const holidayName = customHolidaysMap[dateStr] || customHolidaysMap[mmDd] || (holidaysData && holidaysData[dateStr]);
        if (holidayName) {
          weekHolidays[day] = holidayName;
        }
      });
    }

    document.querySelectorAll("[data-day-header]").forEach(el => {
      const day = el.dataset.dayHeader;
      if (weekHolidays[day]) {
        el.classList.remove("today-header");
        // 見出しに祝日名を赤字で追加
        el.innerHTML = `${day}<br><span style="font-size:0.6em; color:#ff4d4f; font-weight:normal;">${weekHolidays[day]}</span>`;
      } else {
        el.classList.toggle("today-header", day === todayStr);
        el.textContent = day;
      }
    });

    for (let periodIndex = 0; periodIndex < p; periodIndex++) {
      gridBody.appendChild(createEl("div", "grid-cell grid-time", String(periodIndex + 1)));

      days.forEach(day => {
        if (!timetableData[day] || !timetableData[day][periodIndex]) return;

        const data = timetableData[day][periodIndex];
        const cell = document.createElement("div");
        cell.className = `grid-cell ${data.subject ? data.color : ""}`;

        if (weekHolidays[day]) {
          cell.style.opacity = "0.4"; // 祝日の列は半透明にして非アクティブ感を出す
        } else if (day === todayStr && periodIndex === currentPeriod) {
          cell.classList.add("now-active-cell");
        }

        if (data.subject) {
          cell.appendChild(createEl("div", "cell-subject", data.subject));
          if (appSettings.showRoom && data.room) {
            cell.appendChild(createEl("div", "cell-room", data.room));
          }
        }

        cell.addEventListener("click", () => openModal(day, periodIndex));
        gridBody.appendChild(cell);
      });
    }
  }

  function renderSettings() {
    settingShowEmpty.checked = !!appSettings.showEmpty;
    settingShowTeacher.checked = !!appSettings.showTeacher;
    settingShowRoom.checked = !!appSettings.showRoom;
    settingPeriods.value = String(getPeriods());
    if (settingApiKey) {
      settingApiKey.value = localStorage.getItem("gemini_api_key") || "";
    }
    if (settingCustomHolidays) {
      settingCustomHolidays.value = appSettings.customHolidays || "";
    }
  }

  function switchTab(target) {
    [tabHome, tabWeek, tabSettings].forEach(t => t.classList.remove("active"));
    [viewHome, viewWeek, viewSettings].forEach(v => v.classList.remove("active"));

    if (target === "home") {
      tabHome.classList.add("active");
      viewHome.classList.add("active");
      headerTitle.textContent = "今日の時間割";
      renderHome();
    } else if (target === "week") {
      tabWeek.classList.add("active");
      viewWeek.classList.add("active");
      headerTitle.textContent = "1週間の時間割";
      renderWeek();
    } else if (target === "settings") {
      tabSettings.classList.add("active");
      viewSettings.classList.add("active");
      headerTitle.textContent = "設定";
      renderSettings();
    }
  }

  tabHome.addEventListener("click", () => switchTab("home"));
  tabWeek.addEventListener("click", () => switchTab("week"));
  tabSettings.addEventListener("click", () => switchTab("settings"));

  let editingDay = "";
  let editingPeriod = 0;

  function openModal(day, period) {
    if (!days.includes(day)) return;
    if (!Number.isInteger(period) || period < 0 || period >= getPeriods()) return;
    if (!timetableData[day] || !timetableData[day][period]) return;

    editingDay = day;
    editingPeriod = period;
    const data = timetableData[day][period];

    document.getElementById("modal-title").textContent = `${day}曜 ${period + 1}限`;
    document.getElementById("input-subject").value = data.subject || "";
    document.getElementById("input-teacher").value = data.teacher || "";
    document.getElementById("input-room").value = data.room || "";
    document.getElementById("input-memo").value = data.memo || "";
    document.getElementById("input-color").value = data.color || "color-default";
    btnDelete.disabled = !data.subject;

    modal.classList.add("show");
  }

  btnCancel.addEventListener("click", () => modal.classList.remove("show"));

  btnSave.addEventListener("click", () => {
    if (!days.includes(editingDay)) return;
    if (!Number.isInteger(editingPeriod) || editingPeriod < 0 || editingPeriod >= getPeriods()) return;
    if (!timetableData[editingDay] || !timetableData[editingDay][editingPeriod]) return;

    timetableData[editingDay][editingPeriod] = {
      subject: document.getElementById("input-subject").value.trim(),
      teacher: document.getElementById("input-teacher").value.trim(),
      room: document.getElementById("input-room").value.trim(),
      memo: document.getElementById("input-memo").value.trim(),
      color: document.getElementById("input-color").value
    };

    saveAndRefresh();
  });

  btnDelete.addEventListener("click", () => {
    if (!days.includes(editingDay)) return;
    if (!Number.isInteger(editingPeriod) || editingPeriod < 0 || editingPeriod >= getPeriods()) return;
    if (!timetableData[editingDay] || !timetableData[editingDay][editingPeriod]) return;

    if (!confirm(`${editingDay}曜 ${editingPeriod + 1}限のデータを削除しますか？`)) return;

    timetableData[editingDay][editingPeriod] = createEmptyEntry();
    saveAndRefresh();
  });

  modal.addEventListener("click", e => {
    if (e.target === modal) modal.classList.remove("show");
  });

  settingShowEmpty.addEventListener("change", e => {
    appSettings.showEmpty = e.target.checked;
    saveSettings();
    renderHome();
  });

  settingShowTeacher.addEventListener("change", e => {
    appSettings.showTeacher = e.target.checked;
    saveSettings();
    renderHome();
  });

  settingShowRoom.addEventListener("change", e => {
    appSettings.showRoom = e.target.checked;
    saveSettings();
    renderHome();
    renderWeek();
  });

  settingPeriods.addEventListener("change", e => {
    const newPeriods = Number(e.target.value);
    if (!Number.isFinite(newPeriods) || newPeriods < 1 || newPeriods > 8) return;

    appSettings.periods = newPeriods;
    ensureDataShape();
    saveSettings();
    saveTimetable();
    renderHome();
    renderWeek();
  });

  if (settingApiKey) {
    settingApiKey.addEventListener("change", e => {
      const val = e.target.value.trim();
      if (val) {
        localStorage.setItem("gemini_api_key", val);
      } else {
        localStorage.removeItem("gemini_api_key");
      }
    });
  }

  if (btnClearApiKey) {
    btnClearApiKey.addEventListener("click", () => {
      if (confirm("APIキーを削除しますか？")) {
        localStorage.removeItem("gemini_api_key");
        if (settingApiKey) settingApiKey.value = "";
      }
    });
  }

  if (settingCustomHolidays) {
    settingCustomHolidays.addEventListener("change", e => {
      appSettings.customHolidays = e.target.value;
      saveSettings();
      renderHome();
      renderWeek();
    });
  }

  btnExport.addEventListener("click", () => {
    const blob = new Blob(
      [JSON.stringify({ timetableData, appSettings }, null, 2)],
      { type: "application/json" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gachi_timetable_backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  btnImport.addEventListener("click", () => {
    fileImport.click();
  });

  fileImport.addEventListener("change", e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const imported = JSON.parse(ev.target.result);

        if (imported.timetableData && typeof imported.timetableData === "object") {
          timetableData = imported.timetableData;
        }
        if (imported.appSettings && typeof imported.appSettings === "object") {
          appSettings = { ...appSettings, ...imported.appSettings };
        }

        appSettings.periods = getPeriods();
        ensureDataShape();
        saveTimetable();
        saveSettings();
        renderHome();
        renderWeek();
        alert("読み込み完了");
      } catch (err) {
        console.error(err);
        alert("読み込み失敗");
      }
    };
    reader.readAsText(file);
  });

  btnReset.addEventListener("click", () => {
    if (!confirm("全データを削除しますか？")) return;
    localStorage.removeItem("gachi_timetable");
    localStorage.removeItem("gachi_settings");
    location.reload();
  });

  if (btnParsePdf) {
    btnParsePdf.addEventListener("click", async () => {
      if (!pdfUpload.files || !pdfUpload.files.length) {
        alert("PDFファイルを選択してください！");
        return;
      }

      let apiKey = localStorage.getItem("gemini_api_key");
      if (!apiKey) {
        apiKey = prompt("Gemini APIキーを入力してください:");
        if (!apiKey) {
          alert("APIキーが必要です。");
          return;
        }
        localStorage.setItem("gemini_api_key", apiKey);
      }

      const file = pdfUpload.files[0];
      pdfStatus.textContent = "Geminiによる解析中...";

        try {
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = error => reject(error);
          reader.readAsDataURL(file);
        });

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const payload = {
          contents: [{
            parts: [
              { text: "このPDFの時間割を解析し、月曜日から金曜日までの各時限の「科目(subject)」「担当教員(teacher)」「教室(room)」を抽出して、以下のJSONフォーマットで出力してください。\n\n{\n  \"periods\": 最大時限数(数値),\n  \"timetable\": {\n    \"月\": [\n      { \"subject\": \"科目名\", \"teacher\": \"教員名\", \"room\": \"教室\" }\n    ],\n    \"火\": [],\n    \"水\": [],\n    \"木\": [],\n    \"金\": []\n  }\n}\n各曜日の配列は1限から順に最大時限数分だけ格納し、授業がない空きコマの場合は全てのプロパティを空文字(\"\")にしてください。JSON以外のテキストは出力しないでください。" },
              { inlineData: { mimeType: "application/pdf", data: base64Data } }
            ]
          }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        };

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          if (response.status === 400 || response.status === 401 || response.status === 403) {
            localStorage.removeItem("gemini_api_key"); // 認証エラーの場合はキーをリセット
          }
          const err = await response.json();
          throw new Error(err.error?.message || "APIリクエストに失敗しました");
        }

        const data = await response.json();
        const resultText = data.candidates[0].content.parts[0].text;
        const parsedResult = JSON.parse(resultText);

        const detectedPeriods = parsedResult.periods || getPeriods();
        const effectivePeriods = Math.min(Math.max(detectedPeriods, 1), 8);
        appSettings.periods = effectivePeriods;
        initData(effectivePeriods);
        saveSettings();

        days.forEach(day => {
          const dayData = parsedResult.timetable[day];
          if (!dayData || !Array.isArray(dayData)) return;

          for (let i = 0; i < effectivePeriods; i++) {
            if (dayData[i] && dayData[i].subject) {
              timetableData[day][i].subject = dayData[i].subject || "";
              timetableData[day][i].teacher = dayData[i].teacher || "";
              timetableData[day][i].room = dayData[i].room || "";
              timetableData[day][i].color = "color-blue";
            }
          }
        });

        saveAndRefresh();
        pdfStatus.textContent = "解析完了。1週間タブを確認してください。";
      } catch (error) {
        console.error(error);
        pdfStatus.textContent = "PDFの解析に失敗しました。";
        alert("解析エラー: " + error.message);
      }
    });
  }

  async function initHolidays() {
    try {
      const res = await fetch("https://holidays-jp.github.io/api/v1/date.json");
      if (res.ok) {
        holidaysData = await res.json();
        // データ取得後にHomeタブが開かれていれば再描画して祝日を反映
        if (viewHome.classList.contains("active")) renderHome();
        if (viewWeek.classList.contains("active")) renderWeek();
      }
    } catch (e) {
      console.warn("祝日データの取得に失敗しました", e);
    }
  }

  loadSettings();
  loadData();
  ensureDataShape();
  renderHome();
  initHolidays();

  window.addEventListener("keydown", e => {
    if (e.key === "Escape") modal.classList.remove("show");
  });
});

// Service Worker の登録 (PWA対応)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }).catch(err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}