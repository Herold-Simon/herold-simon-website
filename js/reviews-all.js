/* Alle freigeschalteten Bewertungen im Masonry-Grid. */
(function () {
  if (!window.SB) return;
  var sb = window.SB.get();
  var grid = document.querySelector("[data-reviews-grid]");
  if (!grid) return;

  function starString(n) {
    n = n || 0;
    var out = "";
    for (var i = 1; i <= 5; i++) out += i <= n ? "★" : "☆";
    return out;
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  }

  Promise.all([
    sb.from("reviews").select("id,text,stars,author_name,course_id,course_name,created_at").eq("show_on_page", true).order("created_at", { ascending: false }),
    sb.from("courses").select("id,name"),
  ]).then(function (r) {
    if (r[0].error) { grid.innerHTML = "<p class=\"course-empty\">Fehler beim Laden.</p>"; return; }
    var reviews = r[0].data || [];
    if (!reviews.length) {
      grid.innerHTML = "<p class=\"course-empty\">Noch keine Bewertungen veröffentlicht.</p>";
      return;
    }
    var names = {};
    (r[1].data || []).forEach(function (c) { names[c.id] = c.name; });

    grid.innerHTML = "";
    reviews.forEach(function (rv) {
      var card = document.createElement("div");
      card.className = "reviews-masonry-item review-card";

      if (rv.stars) {
        var stars = document.createElement("div");
        stars.className = "review-stars";
        stars.textContent = starString(rv.stars);
        card.appendChild(stars);
      }
      var text = document.createElement("p");
      text.className = "review-text";
      text.textContent = rv.text || "";
      card.appendChild(text);

      var meta = document.createElement("span");
      meta.className = "review-meta";
      var parts = [];
      if (rv.author_name) parts.push(rv.author_name);
      var cName = names[rv.course_id] || rv.course_name;
      if (cName) parts.push(cName);
      var dstr = formatDate(rv.created_at);
      if (dstr) parts.push(dstr);
      meta.textContent = parts.join(" · ");
      card.appendChild(meta);

      grid.appendChild(card);
    });
  });
})();
