/* Kursübergreifende Bewertungs-Verwaltung. Nutzt js/reviews-admin-shared.js. */
(function () {
  var sb = window.SB.get();

  var gate = document.querySelector("[data-gate]");
  var adminView = document.querySelector("[data-admin-view]");
  var logoutLink = document.querySelector("[data-logout]");
  var filterEl = document.querySelector("[data-course-filter]");
  var listEl = document.querySelector("[data-all-reviews]");
  var addBtn = document.querySelector("[data-review-add]");
  var statsEl = document.querySelector("[data-review-stats]");

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

  function ctx() {
    return { sb: sb, toast: toast, reload: loadReviews, courseNames: courseNames };
  }

  async function loadReviews() {
    listEl.innerHTML = "<p class=\"admin-block-sub\">Wird geladen …</p>";
    var q = sb.from("reviews").select("*").order("created_at", { ascending: false });
    if (filterEl.value) q = q.eq("course_id", filterEl.value);
    var res = await q;
    if (res.error) { listEl.innerHTML = "<p>Fehler beim Laden.</p>"; return; }
    var reviews = res.data || [];
    renderStats(reviews);
    window.ReviewCards.renderList(listEl, reviews, ctx());
  }

  function renderStats(reviews) {
    if (!statsEl) return;
    var total = reviews.length;
    var onPage = reviews.filter(function (r) { return r.show_on_page; }).length;
    var marquee = reviews.filter(function (r) { return r.show_in_marquee; }).length;
    var rated = reviews.filter(function (r) { return r.stars; });
    var avg = rated.length ? (rated.reduce(function (s, r) { return s + r.stars; }, 0) / rated.length) : 0;
    statsEl.innerHTML =
      stat(total, "Bewertungen") +
      stat(onPage, "auf der Seite") +
      stat(marquee, "im Laufband") +
      stat(avg ? avg.toFixed(1) + " ★" : "–", "Durchschnitt");
  }
  function stat(value, label) {
    return '<div class="review-stat"><strong>' + value + "</strong><span>" + label + "</span></div>";
  }

  if (addBtn) {
    addBtn.addEventListener("click", function () {
      if (!courseList.length) { toast("Bitte zuerst einen Kurs anlegen.", "error"); return; }
      window.ReviewCards.openAddForm({
        sb: sb,
        toast: toast,
        reload: loadReviews,
        courseList: courseList,
        courseId: filterEl.value || (courseList[0] && courseList[0].id),
      });
    });
  }
})();
