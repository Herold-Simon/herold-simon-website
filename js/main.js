/* Gemeinsames JavaScript für alle Seiten */

document.addEventListener("DOMContentLoaded", function () {
  /* ---------- Mobile Navigation (Hamburger) ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".main-nav");
  var header = document.querySelector(".site-header");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      nav.classList.toggle("open");
      toggle.classList.toggle("open");
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("open");
        toggle.classList.remove("open");
      });
    });
  }

  /* ---------- Hero-Slider ---------- */
  var slider = document.querySelector(".hero-slider");
  if (slider) {
    var slides = slider.querySelectorAll(".slide");
    var dotsWrap = slider.querySelector(".slider-dots");
    var current = 0;
    var dots = [];

    slides.forEach(function (_, i) {
      var dot = document.createElement("button");
      dot.setAttribute("aria-label", "Bild " + (i + 1));
      dot.addEventListener("click", function () { show(i); });
      dotsWrap.appendChild(dot);
      dots.push(dot);
    });

    function show(i) {
      slides[current].classList.remove("active");
      dots[current].classList.remove("active");
      current = i;
      slides[current].classList.add("active");
      dots[current].classList.add("active");
    }

    if (slides.length) {
      show(0);
      setInterval(function () {
        show((current + 1) % slides.length);
      }, 5000);
    }
  }

  /* ---------- Dienstleistungen ein-/ausklappen ---------- */
  var servicesToggle = document.querySelector("[data-services-toggle]");
  var servicesMore = document.querySelector(".services-more");
  if (servicesToggle && servicesMore) {
    servicesToggle.addEventListener("click", function () {
      var open = servicesMore.classList.toggle("open");
      servicesToggle.textContent = open
        ? "Weniger anzeigen"
        : "Alle Dienstleistungen anzeigen";
    });
  }

  /* ---------- Team-Sektion aus Supabase laden ---------- */
  var teamGrid = document.querySelector("[data-team-grid]");
  if (teamGrid && window.SB) {
    renderTeam(teamGrid);
  }

  /* ---------- Galerie aus Supabase laden ---------- */
  var randomGallery = document.querySelector("[data-gallery-random]");
  var fullGallery = document.querySelector("[data-gallery-all]");
  if ((randomGallery || fullGallery) && window.SB) {
    loadGallery(randomGallery, fullGallery);
  }
});

function renderTeam(container) {
  var sb = window.SB.get();
  sb.from("team_members")
    .select("slug,name,title,phone,image1_url")
    .order("sort_order", { ascending: true })
    .then(function (res) {
      if (res.error) { console.error("Team laden:", res.error.message); return; }
      var members = res.data || [];
      container.innerHTML = "";
      members.forEach(function (m) {
        var card = document.createElement("div");
        card.className = "member-card";

        var img = document.createElement("img");
        img.src = window.SB.imgUrl(m.image1_url);
        img.alt = m.name || "";
        img.loading = "lazy";
        card.appendChild(img);

        var info = document.createElement("div");
        info.className = "member-info";

        var title = document.createElement("span");
        title.className = "member-title";
        title.textContent = m.title || "";
        info.appendChild(title);

        var h3 = document.createElement("h3");
        h3.textContent = m.name || "";
        info.appendChild(h3);

        var phone = document.createElement("span");
        phone.className = "member-phone";
        phone.textContent = m.phone || "";
        info.appendChild(phone);

        var link = document.createElement("a");
        link.className = "btn btn-small";
        link.href = "team.html?slug=" + encodeURIComponent(m.slug);
        link.textContent = "Mehr Infos";
        info.appendChild(link);

        card.appendChild(info);

        card.style.cursor = "pointer";
        card.addEventListener("click", function (e) {
          if (e.target.closest("a")) return;
          window.location.href = link.href;
        });

        container.appendChild(card);
      });
    });
}

function loadGallery(randomContainer, fullContainer) {
  var sb = window.SB.get();
  sb.from("gallery_images")
    .select("image_url,alt")
    .order("sort_order", { ascending: true })
    .then(function (res) {
      if (res.error) { console.error("Galerie laden:", res.error.message); return; }
      var images = res.data || [];

      if (randomContainer) {
        var shuffled = images.slice().sort(function () { return Math.random() - 0.5; });
        appendImages(randomContainer, shuffled.slice(0, 4));
      }
      if (fullContainer) {
        appendImages(fullContainer, images);
      }
    });
}

function appendImages(container, images) {
  container.innerHTML = "";
  images.forEach(function (item) {
    var img = document.createElement("img");
    img.src = window.SB.imgUrl(item.image_url);
    img.alt = item.alt || "Impression aus der Pferdepraxis";
    img.loading = "lazy";
    container.appendChild(img);
  });
}
