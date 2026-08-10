// Material renders the header title as plain, auto-escaped text
// ({{ config.site_name }} in partials/header.html), so "Foundry" can't be
// colored via mkdocs.yml or CSS alone without splitting the text node.
document.addEventListener("DOMContentLoaded", () => {
  const topic = document.querySelector(".md-header__topic .md-ellipsis");
  if (topic && topic.textContent.includes("Foundry")) {
    topic.innerHTML = topic.innerHTML.replace(
      "Foundry",
      '<span class="lf-accent">Foundry</span>'
    );
  }
});

// Submits the feedback form (overrides/partials/feedback.html) via fetch
// instead of a native POST, so visitors never leave the page for
// Formspree's own generic "thanks" page.
let lfToastTimer;

function lfShowToast(message, type) {
  let toast = document.querySelector(".lf-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "lf-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = "lf-toast is-visible" + (type === "error" ? " is-error" : "");
  clearTimeout(lfToastTimer);
  lfToastTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 5000);
}

async function lfHandleFormspreeSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('button[type="submit"]');
  const originalLabel = button.textContent;
  const successMessage = form.dataset.successMessage || "Submitted. Thanks!";
  const errorMessage = form.dataset.errorMessage || "Something went wrong. Please try again.";

  button.disabled = true;
  button.textContent = "Sending...";

  try {
    const response = await fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
    });

    if (response.ok) {
      form.reset();
      lfShowToast(successMessage, "success");
    } else {
      const data = await response.json().catch(() => null);
      const detail = data && Array.isArray(data.errors) && data.errors.length
        ? data.errors.map((e) => e.message).join(", ")
        : errorMessage;
      lfShowToast(detail, "error");
    }
  } catch (err) {
    lfShowToast(errorMessage, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".lf-feedback__form");
  if (form) {
    form.addEventListener("submit", lfHandleFormspreeSubmit);
  }
});

// Fade cues on the section tabs bar when it's horizontally scrollable —
// Material hides the native scrollbar entirely (.md-tabs__list), so on a
// narrow window there's otherwise no sign that tabs run off-screen.
document.addEventListener("DOMContentLoaded", () => {
  const list = document.querySelector(".md-tabs__list");
  if (!list) return;

  const left = document.createElement("li");
  left.className = "md-tabs__fade md-tabs__fade--left";
  left.setAttribute("aria-hidden", "true");

  const right = document.createElement("li");
  right.className = "md-tabs__fade md-tabs__fade--right";
  right.setAttribute("aria-hidden", "true");

  list.insertBefore(left, list.firstChild);
  list.appendChild(right);

  function updateTabFades() {
    const maxScroll = list.scrollWidth - list.clientWidth;
    left.classList.toggle("is-visible", list.scrollLeft > 4);
    right.classList.toggle("is-visible", list.scrollLeft < maxScroll - 4);
  }

  updateTabFades();
  list.addEventListener("scroll", updateTabFades, { passive: true });
  window.addEventListener("resize", updateTabFades);
});
