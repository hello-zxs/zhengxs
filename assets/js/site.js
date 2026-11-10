/* zhengxs.com — interface behaviour. No dependencies. */
(() => {
  "use strict";

  const doc = document;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (sel, root = doc) => root.querySelector(sel);
  const $$ = (sel, root = doc) => Array.from(root.querySelectorAll(sel));

  /* ---------------------------------------------------------------- clock */
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Toronto",
  });
  const tickClock = () => {
    const value = timeFmt.format(new Date());
    $$("[data-clock]").forEach((el) => {
      const bold = el.querySelector("b");
      if (bold) bold.textContent = value;
      else el.textContent = value;
    });
  };
  tickClock();
  window.setInterval(tickClock, 20000);

  /* ------------------------------------------------------------ nav / menu */
  const nav = $("[data-nav]");
  const menu = $("#site-menu");
  const menuButton = $("[data-menu-open]");
  let lastFocused = null;

  const openMenu = () => {
    if (!menu || !menuButton) return;
    lastFocused = doc.activeElement;
    menu.classList.add("is-open");
    menu.setAttribute("aria-hidden", "false");
    menuButton.setAttribute("aria-expanded", "true");
    doc.body.classList.add("menu-open");
    const first = menu.querySelector("a, button");
    if (first) first.focus({ preventScroll: true });
  };

  const closeMenu = () => {
    if (!menu || !menuButton) return;
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
    menuButton.setAttribute("aria-expanded", "false");
    doc.body.classList.remove("menu-open");
    if (lastFocused) lastFocused.focus({ preventScroll: true });
  };

  if (menuButton && menu) {
    menuButton.addEventListener("click", () => {
      if (menu.classList.contains("is-open")) closeMenu();
      else openMenu();
    });
    $$("a", menu).forEach((a) => a.addEventListener("click", closeMenu));
    doc.addEventListener("keydown", (e) => {
      if (!menu.classList.contains("is-open")) return;
      if (e.key === "Escape") {
        closeMenu();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = $$("a, button", menu).filter((el) => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && doc.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && doc.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  /* ---------------------------------------------------------- scroll state */
  const progress = $("[data-progress]");
  let ticking = false;

  const onScroll = () => {
    if (nav) nav.classList.toggle("is-scrolled", window.scrollY > 24);
    if (progress) {
      const h = doc.documentElement.scrollHeight - window.innerHeight;
      const p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
      progress.style.transform = `scaleX(${p})`;
    }
    ticking = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(onScroll);
      }
    },
    { passive: true }
  );
  onScroll();

  /* --------------------------------------------------------------- reveals */
  const reveals = $$(".reveal");
  if (reduced || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("is-in"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    reveals.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------ hero intro */
  const intro = () => {
    $$(".anim").forEach((el) => el.classList.add("is-ready"));
    $$("[data-lens]").forEach((el) => el.classList.add("is-ready"));
  };
  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", () => window.setTimeout(intro, 30));
  } else {
    window.setTimeout(intro, 30);
  }

  /* ------------------------------------------------------------------ math */
  let mathDone = false;
  const renderMath = () => {
    if (mathDone || typeof window.renderMathInElement !== "function") return;
    mathDone = true;
    window.renderMathInElement(doc.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
      ],
      throwOnError: false,
      strict: false,
    });
  };
  doc.addEventListener("DOMContentLoaded", renderMath);
  window.addEventListener("load", renderMath);

  /* ------------------------------------------ keyboard access to side-scroll */
  // A listing, figure or table that scrolls sideways must be reachable from the
  // keyboard, or its right-hand half is unreadable without a pointer.
  const markScrollable = () => {
    $$("pre, .figure-scroll, .math-display, .prose table, .paper-body table").forEach((el) => {
      if (el.scrollWidth <= el.clientWidth + 1 || el.hasAttribute("tabindex")) return;
      el.setAttribute("tabindex", "0");
      if (el.tagName === "TABLE") return;
      el.setAttribute("role", "group");
      const kind = el.tagName === "PRE" ? "Code listing" : el.classList.contains("math-display") ? "Equation" : "Figure";
      el.setAttribute("aria-label", `${kind}, scrolls sideways`);
    });
  };
  window.addEventListener("load", markScrollable);
  window.addEventListener("resize", markScrollable, { passive: true });

  /* ------------------------------------------------------------- copy code */
  $$("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = doc.querySelector(button.getAttribute("data-copy"));
      if (!target) return;
      const text = target.textContent || "";
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        const area = doc.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        doc.body.appendChild(area);
        area.select();
        try {
          doc.execCommand("copy");
        } catch (e) {
          /* no-op */
        }
        area.remove();
      }
      const label = button.textContent;
      button.textContent = "Copied";
      window.setTimeout(() => {
        button.textContent = label;
      }, 1600);
    });
  });

  /* ------------------------------------------------------- section indexes */
  const tocLinks = $$("[data-toc-link]");
  if (tocLinks.length && "IntersectionObserver" in window) {
    const sections = tocLinks
      .map((link) => doc.querySelector(link.getAttribute("href")))
      .filter(Boolean);
    const tocObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          tocLinks.forEach((link) => {
            link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
          });
        });
      },
      { rootMargin: "-22% 0px -64% 0px", threshold: 0 }
    );
    sections.forEach((section) => tocObserver.observe(section));
  }

  /* ---------------------------------------------------------- external links */
  $$('a[href^="http"]').forEach((a) => {
    if (a.hostname && a.hostname !== window.location.hostname) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
  });

  /* -------------------------------------------------------- reduced motion */
  if (reduced) {
    $$(".anim, .reveal, [data-lens]").forEach((el) => el.classList.add("is-ready", "is-in"));
  }
})();
