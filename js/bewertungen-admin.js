/* Kursübergreifende Bewertungs-Verwaltung. */
(function () {
  var sb = window.SB.get();

  var gate = document.querySelector("[data-gate]");
  var adminView = document.querySelector("[data-admin-view]");
  var logoutLink = document.querySelector("[data-logout]");
  var filterEl = document.querySelector("[data-course-filter]");
  var listEl = document.querySelector("[data-all-reviews]");
  var addBtn = document.querySelector("[data-review-add]");

  var courseNames = {};
  var courseList = [];

  /* ---------- Toast ---------- */
  var toastEl = document.querySelector("[data-toast]");
  var toastTimer = null;
  function toast(msg, type) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.className = "admin-toast show" + (type ? " " + type : "");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = "admin-toast"; }, 3000);
  }

  function starString(n) {
    n = n || 0;
    var out = "";
    for (var i = 1; i <= 5; i++) out += i <= n ? "★" : "☆";
    return out;
  }

  /* ---------- Init / Auth ---------- */
  (async function init() {
    var session = (await sb.auth.getSession()).data.session;
    if (!session) { window.location.href = "admin.html"; return; }
    if (gate) gate.style.display = "none";
    adminView.style.display = "";
    if (logoutLink) logoutLink.style.display = "";

    var cRes = await sb.from("courses").select("id,name,event_date").order("event_date", { ascending: false });
    courseList = cRes.data || [];
    courseList.forEach(function (c) {
      courseNames[c.id] = c.name;
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name + (c.event_date ? " (" + c.event_date + ")" : "");
      filterEl.appendChild(opt);
    });

    loadReviews();
  })();

  if (logoutLink) {
    logoutLink.addEventListener("click", async function (e) {
      e.preventDefault();
      await sb.auth.signOut();
      window.location.href = "admin.html";
    });
  }

  if (filterEl) filterEl.addEventListener("change", loadReviews);

  async function loadReviews() {
    listEl.innerHTML = "<p class=\"admin-block-sub\">Wird geladen …</p>";
    var q = sb.from("reviews").select("*").order("created_at", { ascending: false });
    if (filterEl.value) q = q.eq("course_id", filterEl.value);
    var res = await q;
    if (res.error) { listEl.innerHTML = "<p>Fehler beim Laden.</p>"; return; }
    renderRows(res.data || []);
  }

  function renderRows(reviews) {
    listEl.innerHTML = "";
    if (!reviews.length) {
      listEl.innerHTML = "<p class=\"admin-block-sub\">Keine Bewertungen.</p>";
      return;
    }
    reviews.forEach(function (r) {
      var row = document.createElement("div");
      row.className = "review-admin-row";

      var main = document.createElement("div");
      main.className = "review-admin-main";
      var stars = document.createElement("div");
      stars.className = "review-stars";
      stars.textContent = r.stars ? starString(r.stars) : "";
      main.appendChild(stars);
      var text = document.createElement("p");
      text.className = "review-admin-text";
      text.textContent = r.text || "(kein Text)";
      main.appendChild(text);
      var meta = document.createElement("span");
      meta.className = "review-meta";
      var parts = [];
      if (r.author_name) parts.push(r.author_name);
      if (courseNames[r.course_id]) parts.push(courseNames[r.course_id]);
      if (r.created_at) parts.push(new Date(r.created_at).toLocaleDateString("de-DE"));
      meta.textContent = parts.join(" · ");
      main.appendChild(meta);
      row.appendChild(main);

      var controls = document.createElement("div");
      controls.className = "review-admin-controls";
      controls.appendChild(toggle("Auf Seite", r.show_on_page, function (val) {
        return update(r.id, { show_on_page: val });
      }));
      controls.appendChild(toggle("Laufband", r.show_in_marquee, function (val) {
        return update(r.id, { show_in_marquee: val });
      }));
      var del = document.createElement("button");
      del.className = "btn btn-small btn-danger";
      del.textContent = "Löschen";
      del.addEventListener("click", async function () {
        if (!window.confirm("Diese Bewertung löschen?")) return;
        var dr = await sb.from("reviews").delete().eq("id", r.id);
        if (dr.error) { toast("Fehler: " + dr.error.message, "error"); return; }
        loadReviews();
        toast("Bewertung gelöscht.", "success");
      });
      controls.appendChild(del);
      row.appendChild(controls);

      listEl.appendChild(row);
    });
  }

  async function update(id, patch) {
    var up = await sb.from("reviews").update(patch).eq("id", id);
    if (up.error) { toast("Fehler: " + up.error.message, "error"); return false; }
    toast("Gespeichert.", "success");
    return true;
  }

  function toggle(label, checked, onChange) {
    var wrap = document.createElement("label");
    wrap.className = "review-toggle";
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!checked;
    cb.addEventListener("change", async function () {
      var ok = await onChange(cb.checked);
      if (ok === false) cb.checked = !cb.checked;
    });
    wrap.appendChild(cb);
    wrap.appendChild(document.createTextNode(" " + label));
    return wrap;
  }

  if (addBtn) {
    addBtn.addEventListener("click", function () {
      if (!courseList.length) { toast("Bitte zuerst einen Kurs anlegen.", "error"); return; }
      var courseId = filterEl.value;
      if (!courseId) {
        var name = window.prompt("Zu welchem Kurs? Bitte genauen Namen eingeben:\n" + courseList.map(function (c) { return "- " + c.name; }).join("\n"));
        if (!name) return;
        var found = courseList.find(function (c) { return c.name === name.trim(); });
        if (!found) { toast("Kurs nicht gefunden.", "error"); return; }
        courseId = found.id;
      }
      var text = window.prompt("Bewertungstext:");
      if (text === null) return;
      var starsStr = window.prompt("Sterne (1-5, leer für keine):", "5");
      if (starsStr === null) return;
      var author = window.prompt("Name (optional):", "");
      var stars = parseInt(starsStr, 10);
      if (isNaN(stars) || stars < 1 || stars > 5) stars = null;
      sb.from("reviews").insert({
        course_id: courseId,
        author_name: author ? author.trim() : null,
        text: text.trim() || null,
        stars: stars,
        show_on_page: true,
        show_in_marquee: false,
      }).then(function (res) {
        if (res.error) { toast("Fehler: " + res.error.message, "error"); return; }
        loadReviews();
        toast("Bewertung hinzugefügt.", "success");
      });
    });
  }
})();
