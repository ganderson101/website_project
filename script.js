// script.js — Tiny helpers for the site. Start simple so a beginner can learn.

// This script currently does not change navigation (links work without JS).
// We add a small example: show a message when a button is clicked.

document.addEventListener("click", (e) => {
  if (e.target.matches(".btn")) {
    // For now, we just log; later we could animate or send analytics
    console.log("Button clicked:", e.target.textContent.trim());
  }
});

// Keyboard helper: pressing Enter while focused on the button acts like clicking.
// (Anchors already support this, but this shows how to add extra behavior.)
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const active = document.activeElement;
    if (active && active.matches && active.matches(".btn")) {
      active.click();
    }
  }
});
