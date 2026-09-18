(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const webappConfig = window.CE_WEBAPP || {};
  const WEBAPP_URL = String(webappConfig.url || "").trim();
  const WEBAPP_SECRET = String(webappConfig.secret || "").trim();
  const ATTRIBUTION_KEY = "ce_mkt_attribution_v1";
  const TRACK_PARAMS = [
    "gclid", "gbraid", "wbraid",
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
    "fbclid", "msclkid", "dclid", "ttclid", "li_fat_id"
  ];

  const readAttribution = () => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) || "{}");
      const url = new URL(window.location.href);
      TRACK_PARAMS.forEach((key) => {
        const value = url.searchParams.get(key);
        if (value) stored[key] = value;
      });
      if (!stored.landing_page) stored.landing_page = window.location.pathname + window.location.search;
      if (!stored.first_touch_at) stored.first_touch_at = new Date().toISOString();
      stored.page_url = window.location.href;
      stored.referrer = document.referrer || "";
      sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(stored));
      return stored;
    } catch {
      return { page_url: window.location.href, referrer: document.referrer || "" };
    }
  };

  readAttribution();

  const requestMeta = () => ({
    pageUrl: window.location.href,
    userAgent: navigator.userAgent
  });

  const isFileProtocol = window.location.protocol === "file:";

  const ensureWebAppRelay = () => {
    const frameId = "ce-webapp-relay";
    let iframe = document.getElementById(frameId);
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = frameId;
      iframe.name = frameId;
      iframe.title = "Form submission relay";
      iframe.hidden = true;
      iframe.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";
      document.body.appendChild(iframe);
    }
    return iframe;
  };

  const postToWebApp = (eventType, extra = {}) => {
    if (!WEBAPP_URL) return Promise.resolve(false);
    if (isFileProtocol) return Promise.resolve(false);

    const body = {
      eventType,
      siteLabel: String(webappConfig.siteLabel || "").trim() || undefined,
      attribution: readAttribution(),
      meta: requestMeta(),
      ...extra
    };
    if (WEBAPP_SECRET) body.secret = WEBAPP_SECRET;

    return new Promise((resolve) => {
      const iframe = ensureWebAppRelay();
      const form = document.createElement("form");
      form.method = "POST";
      form.action = WEBAPP_URL;
      form.target = iframe.name;
      form.style.display = "none";

      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "payload";
      input.value = JSON.stringify(body);
      form.appendChild(input);

      document.body.appendChild(form);
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        form.remove();
        resolve(ok);
      };

      iframe.addEventListener("load", () => finish(true), { once: true });
      setTimeout(() => finish(true), 5000);
      form.submit();
    });
  };

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const mobileNav = document.querySelector("#mobile-nav");

  const products = {
    machinery: {
      tab: "tab-machinery",
      image: "assets/machinery-detail.webp",
      alt: "Close-up of industrial production machinery.",
      kicker: "Machinery & industrial equipment",
      heading: "CE marking support for industrial systems",
      text: "Industrial machinery, production and packaging lines, material-handling equipment, processing equipment, control systems and special-purpose machines.",
      items: [
        "Industrial machinery",
        "Production machinery",
        "Packaging machinery",
        "Material-handling equipment",
        "Processing equipment",
        "Industrial systems and control systems"
      ],
      link: "Check machinery requirements"
    },
    electrical: {
      tab: "tab-electrical",
      image: "assets/electronics-detail.webp",
      alt: "Electronic circuit boards and industrial control equipment on a workbench.",
      kicker: "Electrical & electronic equipment",
      heading: "Electrical safety, EMC and related European rules",
      text: "Depending on the product, requirements relating to electrical safety, electromagnetic compatibility, hazardous substances or other European rules may need to be considered.",
      items: [
        "Electrical equipment",
        "Electronic equipment",
        "Control panels",
        "Power equipment",
        "Laboratory equipment",
        "Industrial electronics and consumer electrical products"
      ],
      link: "Check electrical requirements"
    },
    medical: {
      tab: "tab-medical",
      image: "assets/medical-equipment.webp",
      alt: "Laboratory medical diagnostic equipment on a stainless steel table.",
      kicker: "Medical devices & IVD products",
      heading: "Regulatory pathway support for applicable medical products",
      text: "Support for products covered by European medical-device or in-vitro diagnostic requirements, including classification, documentation and Notified Body coordination where required.",
      items: [
        "Product classification assessment",
        "Standards identification",
        "Technical-documentation guidance",
        "Risk-management documentation",
        "Conformity-assessment pathway",
        "Notified Body coordination where required"
      ],
      link: "Check medical device requirements"
    },
    pressure: {
      tab: "tab-pressure",
      image: "assets/pressure-equipment.webp",
      alt: "Industrial pressure vessels, valves and piping in a plant room.",
      kicker: "Pressure equipment",
      heading: "CE marking support for applicable pressure products",
      text: "Support for pressure vessels, boilers, pressure assemblies, piping, pressure accessories and industrial pressure equipment falling under applicable European rules.",
      items: [
        "Pressure vessels",
        "Boilers",
        "Pressure assemblies",
        "Piping",
        "Pressure accessories",
        "Industrial pressure equipment"
      ],
      link: "Check pressure equipment requirements"
    },
    ppe: {
      tab: "tab-ppe",
      image: "assets/technical-file.webp",
      alt: "Technical documentation used to evidence product conformity.",
      kicker: "Personal protective equipment",
      heading: "European PPE requirements, standards and assessment",
      text: "Support for products subject to applicable European PPE requirements, including assessment of relevant standards, documentation and conformity-assessment requirements.",
      items: [
        "Applicable PPE classification",
        "Relevant standards identification",
        "Technical documentation",
        "Testing coordination where required",
        "Conformity-assessment route",
        "Labelling and instruction review"
      ],
      link: "Check PPE requirements"
    },
    radio: {
      tab: "tab-radio",
      image: "assets/electronics-detail.webp",
      alt: "Connected electronic assemblies used in wireless and IoT products.",
      kicker: "Radio & wireless equipment",
      heading: "Compliance support for connected and radio products",
      text: "Support for wireless equipment, radio products, IoT devices, connected devices, telecom equipment and wireless control products.",
      items: [
        "Wireless equipment",
        "Radio products",
        "IoT devices",
        "Connected devices",
        "Telecom equipment",
        "Wireless control products"
      ],
      link: "Check radio equipment requirements"
    },
    construction: {
      tab: "tab-construction",
      image: "assets/chennai-corridor.webp",
      alt: "Industrial buildings and manufacturing roofs in a production corridor.",
      kicker: "Construction products",
      heading: "Performance documentation and conformity assessment",
      text: "Support with applicable European requirements, standards, performance documentation, testing and conformity assessment for relevant construction products.",
      items: [
        "Applicable requirements mapping",
        "Standards identification",
        "Performance documentation",
        "Testing coordination",
        "Conformity assessment",
        "Declaration and labelling review"
      ],
      link: "Check construction product requirements"
    },
    toys: {
      tab: "tab-toys",
      image: "assets/technical-file.webp",
      alt: "Product assessment documents used for safety and technical files.",
      kicker: "Toys & children's products",
      heading: "European toy-safety requirements and technical evidence",
      text: "Support for applicable safety requirements, product assessment, testing, risk assessment and technical documentation for products falling under European toy-safety requirements.",
      items: [
        "Product assessment",
        "Safety requirements",
        "Testing coordination",
        "Risk assessment",
        "Technical documentation",
        "Labelling and instruction review"
      ],
      link: "Check toy safety requirements"
    }
  };

  const backToTop = document.querySelector("#back-to-top");
  if (backToTop) {
    const showAfter = 420;
    const syncTop = () => {
      backToTop.hidden = window.scrollY < showAfter;
    };
    syncTop();
    window.addEventListener("scroll", syncTop, { passive: true });
    backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    });
  }

  if (toggle && mobileNav) {
    const closeMenu = () => {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
      mobileNav.hidden = true;
      document.body.classList.remove("nav-open");
    };

    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      toggle.setAttribute("aria-label", open ? "Open menu" : "Close menu");
      mobileNav.hidden = open;
      document.body.classList.toggle("nav-open", !open);
    });
    mobileNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });
    window.matchMedia("(min-width: 1024px)").addEventListener("change", (event) => {
      if (event.matches) closeMenu();
    });
  }

  const tabs = document.querySelectorAll(".product-tabs [role='tab']");
  const image = document.querySelector("#product-image");
  const kicker = document.querySelector("#product-kicker");
  const heading = document.querySelector("#product-heading");
  const text = document.querySelector("#product-text");
  const list = document.querySelector("#product-list");
  const panel = document.querySelector("#panel-product");
  const panelLink = panel ? panel.querySelector(".text-link") : null;

  const setProduct = (key) => {
    const data = products[key];
    if (!data) return;
    tabs.forEach((tab) => {
      const selected = tab.dataset.product === key;
      tab.setAttribute("aria-selected", String(selected));
    });
    if (panel) panel.setAttribute("aria-labelledby", data.tab);
    if (image) {
      image.src = data.image;
      image.alt = data.alt;
    }
    if (kicker) kicker.textContent = data.kicker;
    if (heading) heading.textContent = data.heading;
    if (text) text.textContent = data.text;
    if (list) {
      list.innerHTML = data.items.map((item) => `<li>${item}</li>`).join("");
    }
    if (panelLink) panelLink.textContent = data.link;
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => setProduct(tab.dataset.product));
    tab.addEventListener("keydown", (event) => {
      const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const items = [...tabs];
      const index = items.indexOf(tab);
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % items.length;
      if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = items.length - 1;
      items[next].focus();
      setProduct(items[next].dataset.product);
    });
  });

  const form = document.querySelector("#ce-form");
  const errorBox = document.querySelector("#form-errors");
  const errorList = errorBox ? errorBox.querySelector("ul") : null;
  const submitBtn = document.querySelector("#submit-btn");
  const success = document.querySelector("#form-success");

  const fieldLabel = (id) => {
    const label = document.querySelector(`label[for="${id}"]`);
    return label ? label.textContent.replace("*", "").trim() : id;
  };

  document.querySelector(".action-dock__call")?.addEventListener("click", () => {
    postToWebApp("call");
  });

  document.querySelector(".action-dock__wa")?.addEventListener("click", () => {
    postToWebApp("whatsapp");
  });

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const issues = [];
      const requiredIds = ["name", "company", "phone", "email", "location", "category", "product"];
      requiredIds.forEach((id) => {
        const field = form.querySelector(`#${id}`);
        if (!field || !String(field.value).trim()) {
          issues.push({ id, message: `Enter ${fieldLabel(id).toLowerCase()}` });
        }
      });
      const email = form.querySelector("#email");
      if (email && email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
        issues.push({ id: "email", message: "Enter a valid business email" });
      }
      if (!form.querySelector("input[name='export']:checked")) {
        issues.push({ id: "export-set", message: "Select whether you plan to export to Europe" });
      }
      if (!form.querySelector("input[name='reports']:checked")) {
        issues.push({ id: "reports-set", message: "Select whether you have existing test reports" });
      }

      if (issues.length) {
        if (errorBox && errorList) {
          errorBox.hidden = false;
          errorList.innerHTML = issues
            .map((issue) => `<li><a href="#${issue.id}">${issue.message}</a></li>`)
            .join("");
          errorBox.focus();
        }
        return;
      }

      if (isFileProtocol) {
        if (errorBox && errorList) {
          errorBox.hidden = false;
          errorList.innerHTML =
            "<li>Open this page through a local web server (not as a file:// link). Example: run <code>python -m http.server 8765</code> in the site folder, then visit <code>http://localhost:8765/</code>.</li>";
          errorBox.focus();
        }
        return;
      }

      if (!WEBAPP_URL) {
        if (errorBox && errorList) {
          errorBox.hidden = false;
          errorList.innerHTML = "<li>Form is not connected yet. Add your Google Apps Script web app URL in index.html.</li>";
          errorBox.focus();
        }
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending enquiry…";
      }
      if (errorBox) errorBox.hidden = true;

      const exportChoice = form.querySelector("input[name='export']:checked");
      const reportsChoice = form.querySelector("input[name='reports']:checked");
      const honey = form.querySelector("[name='_honey']");

      const payload = {
        form: {
          name: form.querySelector("#name")?.value?.trim(),
          company: form.querySelector("#company")?.value?.trim(),
          phone: form.querySelector("#phone")?.value?.trim(),
          email: form.querySelector("#email")?.value?.trim(),
          location: form.querySelector("#location")?.value?.trim(),
          category: form.querySelector("#category")?.value?.trim(),
          product: form.querySelector("#product")?.value?.trim(),
          export: exportChoice ? exportChoice.value : "",
          reports: reportsChoice ? reportsChoice.value : "",
          details: form.querySelector("#details")?.value?.trim() || "",
          _honey: honey ? honey.value : ""
        }
      };

      const fileInput = form.querySelector("#file");
      const file = fileInput?.files?.[0];
      if (file && file.size <= 8 * 1024 * 1024) {
        try {
          payload.attachment = {
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            data: await fileToBase64(file)
          };
        } catch {
          /* send without attachment */
        }
      }

      await postToWebApp("form", payload);

      if (success) success.hidden = false;
      form.reset();
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Get my CE marking quote";
      }
    });
  }

  const splitHeading = (node) => {
    if (!node || node.dataset.splitReady) return;
    const accent = node.querySelector(".hero-city");
    const accentWord = accent ? accent.textContent.trim() : "";
    const textValue = node.textContent.trim();
    node.dataset.splitReady = "true";
    const words = textValue.split(/\s+/);
    const visual = document.createElement("span");
    visual.setAttribute("aria-hidden", "true");
    visual.className = "split-visual";
    visual.innerHTML = words
      .map((word) => {
        const cityClass = accentWord && word === accentWord ? " hero-city" : "";
        return `<span class="word${cityClass}"><span class="word-inner">${word}</span></span>`;
      })
      .join(" ");
    const accessible = document.createElement("span");
    accessible.className = "visually-hidden";
    accessible.textContent = textValue;
    node.textContent = "";
    node.append(accessible, visual);
  };

  if (!document.getElementById("a11y-style")) {
    const style = document.createElement("style");
    style.id = "a11y-style";
    style.textContent = `.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.word{display:inline-block;overflow:hidden;vertical-align:bottom}.word-inner{display:inline-block}`;
    document.head.append(style);
  }

  const heroTitle = document.querySelector("[data-split]");
  if (!reduce) splitHeading(heroTitle);

  const bootMotion = () => {
    if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;
    gsap.registerPlugin(ScrollTrigger);

    let lenis = null;
    let tick = null;
    const allowSmooth = window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches;
    if (!reduce && allowSmooth && typeof Lenis !== "undefined") {
      lenis = new Lenis({
        duration: 1.1,
        smoothWheel: true,
        touchMultiplier: 1.1
      });
      lenis.on("scroll", ScrollTrigger.update);
      tick = (time) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      window.addEventListener("beforeunload", () => {
        if (tick) gsap.ticker.remove(tick);
        lenis.destroy();
        ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      });
    }

    if (reduce) {
      document.querySelectorAll(".pathway-steps li").forEach((item) => item.classList.add("is-active"));
      const count = document.querySelector("#stamp-step");
      if (count) count.textContent = "10";
      return;
    }

    const intro = gsap.timeline({ defaults: { ease: "power2.out" } });
    intro
      .from(".hero-copy .eyebrow", { y: 12, opacity: 0, duration: 0.5 })
      .from(".word-inner", { yPercent: 110, duration: 0.8, stagger: 0.05 }, "-=0.15")
      .from(".lede, .hero-actions, .hero-proof", { y: 16, opacity: 0, duration: 0.5, stagger: 0.08 }, "-=0.4");

    document.querySelectorAll(".scene-intro, .split-note, .product-inspector, .belt-route, .gates, .file-spread, .why-bands, .cost-ledger, .faq-split, .quote-form").forEach((el) => {
      gsap.from(el, {
        opacity: 0,
        y: 16,
        duration: 0.5,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 88%" }
      });
    });

    const steps = gsap.utils.toArray(".pathway-steps li");
    const count = document.querySelector("#stamp-step");
    const ink = document.querySelector(".stamp-ink");
    const draws = gsap.utils.toArray(".ce-draw");
    const drawCe = window.matchMedia("(min-width: 1024px)").matches;

    if (drawCe) {
      draws.forEach((path) => {
        const length = path.getTotalLength ? path.getTotalLength() : 240;
        path.style.strokeDasharray = String(length);
        path.style.strokeDashoffset = String(length);
      });
    }

    const pathway = gsap.timeline({
      scrollTrigger: {
        trigger: ".scene-pathway",
        start: "top 70%",
        end: "bottom 55%",
        scrub: 0.7,
        onUpdate: (self) => {
          const step = Math.min(10, Math.max(0, Math.round(self.progress * 10)));
          if (count) count.textContent = String(step).padStart(2, "0");
          steps.forEach((item, index) => {
            item.classList.toggle("is-active", index < step);
          });
        }
      }
    });

    if (drawCe) {
      pathway
        .to(draws, { strokeDashoffset: 0, duration: 1, stagger: 0.08 }, 0)
        .to(ink, { scale: 1, opacity: 0.9, duration: 1 }, 0);
    }

    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    document.fonts?.ready?.then(refresh);
  };

  bootMotion();
})();
