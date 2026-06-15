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

  /* ---------- Mitarbeiter-Karten klickbar machen ---------- */
  document.querySelectorAll(".member-card").forEach(function (card) {
    var link = card.querySelector("a.btn");
    if (!link) return;
    card.style.cursor = "pointer";
    card.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;
      window.location.href = link.href;
    });
  });

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

    show(0);
    setInterval(function () {
      show((current + 1) % slides.length);
    }, 5000);
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

  /* ---------- Galerie ---------- */
  var GALLERY_IMAGES = [
    "00322e_035b19b53be741d5b7d1189578b33162~mv2.avif",
    "00322e_162da8c452974869b56469bd742ad72d~mv2.avif",
    "00322e_181088d681974ad990b226d71fbd0326~mv2.avif",
    "00322e_254d1d3d38c64e43b6d372095cd934f9~mv2.avif",
    "00322e_2de7b02762a741e98c6b56f478f0d274~mv2.avif",
    "00322e_33ee2dbfaa514fdebb604172a5a000d0~mv2.avif",
    "00322e_38db7057f6e448baa081aee977351d42~mv2.avif",
    "00322e_39f8568bd744408db0e0ec72e8ba99b5~mv2.avif",
    "00322e_42867d89f4a04ea79163670541b15bcb~mv2.avif",
    "00322e_45cbb36eb41847a8a42ba4050da70792~mv2.avif",
    "00322e_49a9442fc2fa4449ada34bd071e05329~mv2.avif",
    "00322e_4cc46bce80ec4aecb9f4d9faed551f45~mv2.avif",
    "00322e_4e01d4cc40c342429f387b4e22c71c78~mv2.avif",
    "00322e_5a180372135442eb9e7aa0846b3c900d~mv2.avif",
    "00322e_680e23aa221c49219c35039444155ddd~mv2.avif",
    "00322e_6b4947134bee4078913f43caf26e37a4~mv2.avif",
    "00322e_7428a15a6e4f466bab1ee53c203e174b~mv2.avif",
    "00322e_7b5c4a5c018f4ad2a1234bef048ef39e~mv2.avif",
    "00322e_7ba6017eeb254a98b26b2ac7860fedf3~mv2.avif",
    "00322e_8749310003084edd87591386138f82e0~mv2.avif",
    "00322e_926abd1e247645e4b5c09975ba55c89b~mv2.avif",
    "00322e_99fc8b621d9d4b6981705f62207c6849~mv2.avif",
    "00322e_9d442af5e0fc4a5dbc9e254dcad3058b~mv2.avif",
    "00322e_9ee1a109130c479f85344e04cd9ee020~mv2.avif",
    "00322e_a6650958062146779533f0cd9c918524~mv2.avif",
    "00322e_a8b12fc5a9ab44a48236e66ae8ff248e~mv2.avif",
    "00322e_b72d383e95b04141bb491c295710ef7c~mv2.avif",
    "00322e_b8fcc15478c041adabcdf022b5b54ebb~mv2.avif",
    "00322e_c77cb71344e44b00af47c3dd53c759f9~mv2.avif",
    "00322e_ca03c7c67fa64143a16001ca6c0258a6~mv2.avif",
    "00322e_ce8bab5991604916af24611f905243fc~mv2.avif",
    "00322e_da55741af27c4b87b8a6998c6b096b27~mv2.avif",
    "00322e_de017874154349cdb2423a6e5624a043~mv2.avif",
    "00322e_e2c88e93f6754a1980788e465fc37227~mv2.avif",
    "00322e_e7faec4310a841d0a391f22b13547118~mv2.avif",
    "00322e_fab99c8e31854e2e874033f90e585d7c~mv2.avif",
    "3c461f_67abb7b878f745728be94d7d1d61d6fa~mv2.avif"
  ];

  function renderGallery(container, files) {
    files.forEach(function (file) {
      var img = document.createElement("img");
      img.src = "Galerie/" + encodeURIComponent(file);
      img.alt = "Impression aus der Pferdepraxis";
      img.loading = "lazy";
      container.appendChild(img);
    });
  }

  /* 4 zufällige Bilder auf der Startseite */
  var randomGallery = document.querySelector("[data-gallery-random]");
  if (randomGallery) {
    var shuffled = GALLERY_IMAGES.slice().sort(function () {
      return Math.random() - 0.5;
    });
    renderGallery(randomGallery, shuffled.slice(0, 4));
  }

  /* Alle Bilder auf Bilder.html */
  var fullGallery = document.querySelector("[data-gallery-all]");
  if (fullGallery) {
    renderGallery(fullGallery, GALLERY_IMAGES);
  }
});
