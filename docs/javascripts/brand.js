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
