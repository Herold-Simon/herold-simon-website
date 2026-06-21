/* Lädt eine einzelne Mitarbeiter-Detailseite anhand ?slug= aus Supabase. */
document.addEventListener("DOMContentLoaded", function () {
  var photo = document.querySelector("[data-cv-photo]");
  var content = document.querySelector("[data-cv-content]");
  if (!content || !window.SB) return;

  var slug = new URLSearchParams(window.location.search).get("slug");
  if (!slug) {
    content.innerHTML = "<h1>Nicht gefunden</h1><p>Es wurde kein Mitarbeiter angegeben.</p>";
    return;
  }

  var sb = window.SB.get();
  sb.from("team_members")
    .select("*")
    .eq("slug", slug)
    .maybeSingle()
    .then(function (res) {
      if (res.error || !res.data) {
        document.title = "Nicht gefunden – Dr. Herold & Dr. Simon";
        content.innerHTML = "<h1>Nicht gefunden</h1><p>Dieser Mitarbeiter existiert nicht.</p>";
        return;
      }
      var m = res.data;
      document.title = m.name + " – Dr. Herold & Dr. Simon";

      if (photo && m.image2_url) {
        var img = document.createElement("img");
        img.src = window.SB.imgUrl(m.image2_url);
        img.alt = m.name || "";
        photo.appendChild(img);
      } else if (photo) {
        photo.style.display = "none";
      }

      var html = '<div class="cv-header">';
      html += "<h1>" + escapeHtml(m.name || "") + "</h1>";
      if (m.detail_title) {
        html += '<div class="member-title">' + m.detail_title + "</div>";
      }
      if (m.phone) {
        html += "<p><strong></strong><a href=\"tel:" + telHref(m.phone) + "\">" + escapeHtml(m.phone) + "</a></p>";
      }
      html += "</div>";
      html += m.cv_text || "";
      content.innerHTML = html;
    });

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function telHref(phone) {
    var digits = String(phone).replace(/[^0-9]/g, "");
    if (digits.indexOf("0") === 0) digits = "49" + digits.slice(1);
    return "+" + digits;
  }
});
