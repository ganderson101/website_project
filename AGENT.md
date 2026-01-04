# Project Agent Specification (Simple for beginners)

## Purpose ✅

This file tells a helper (an "agent") how to help you build, test, and put your website online. It is written in simple words so a 12-year-old with no website experience can follow it.

---

## Big idea (in one sentence) 💡

Start with a very simple website (one page) and make it better over time. The agent helps you do that step-by-step and asks questions before making big changes.

---

## What the agent can do (short list) 🔧

- Read your project files (like `index.html`, `styles.css`, `script.js`, `package.json`).
- Create new files for you (HTML, CSS, JS, README, DEPLOY.md).
- Run simple commands (like start a local server so you can see the website).
- Explain things in easy words and show exactly what to click or type.
- Ask before doing anything that might break things or delete stuff.

---

## Simple commands (fill in these for your project) ✍️

- BUILD_CMD: (leave blank for a simple static site; example later: `npm run build`)
- START_CMD: `npx serve .` or `python -m http.server 8000` (use one to preview locally)
- TEST_CMD: (none by default)
- LINT_CMD: (none by default)
- FORMAT_CMD: (none by default)
- DEPLOY_TARGET: `Synology NAS (local)`
- DEPLOY_CMD: (see DEPLOY.md for steps; this depends on whether you use Web Station or Docker)

> Tip: For a tiny starter site you do not need a build step. Just open `index.html` in a browser or run the `START_CMD` above.

---

## Rules for the agent (simple language) 📜

- If the request is unclear, ask one question to make it clear.
- Before changing files, list the changes and ask for your “OK”.
- For anything that deletes files or pushes to the live site, ask for a direct confirmation (like: "Yes, deploy now").
- Never put secret keys in the project files. If you need them, put a placeholder in `.env.example`.
- Try to keep changes small and easy to test.

---

## How the agent will work (step-by-step) 🧭

1. Create a new branch called `agent/<short-description>`.
2. Run tests and checks (if any). If there are none, skip this.
3. Make small edits and save with clear commit messages like `ui: add header`.
4. Push the branch and ask you to review before merging.
5. Every time you answer, offer a easily clickable example or view of the webesite.

---

## File creation order and what each file does (for a beginner) 📁

1. `index.html` — The main page (what people see). Start with simple text, a title, and a link to your CSS and JS.
2. `styles.css` — Makes the page look nicer (colors, fonts, spacing).
3. `script.js` — Adds little interactions (like clicking a button to show a message).
4. `README.md` — Short instructions: how to run and preview the site (one or two commands).
5. `AGENT.md` — (this file) tells the agent how to help.
6. `.env.example` — A safe place to list secret names (not the real secrets).
7. `DEPLOY.md` — Exact steps to put the site on your Synology NAS (or another place).

Start with `index.html` and `styles.css`. Add `script.js` when you want something interactive.

---

## Beginner-friendly examples (what the agent will say) 🗣️

- "Do you want me to make a simple page called `index.html` with your name and a picture?"
- "I will create a branch `agent/add-index` and add `index.html`. Say `Yes` to continue."
- "Do you want me to help make this page look nicer with a color and a font?"

---

## How to host on your Synology NAS (easy way) 🖥️➡️📶

Use these steps if you want the site available on your home network (free):

Option A — Web Station (easiest for static sites):

1. On your Synology, open Package Center and install **Web Station**.
2. Put your site files into the `web` shared folder (e.g., `/volume1/web/my-site`).
3. In Web Station, create a new **Virtual Host** and point it to that folder.
4. Visit `http://<your-nas-ip>/my-site/` on a browser in your network to check it.

Option B — Docker with Nginx (more flexible, still free):

1. Install **Docker** from Package Center.
2. Start an `nginx:alpine` container and mount your project folder into `/usr/share/nginx/html`.
3. Map port 80 or another port to access it: `http://<your-nas-ip>:<port>`.

Safety tips:

- Keep the site private on your network if you don't want it public.
- If you want the site accessible from the internet, enable firewall rules carefully and consider using HTTPS (Let's Encrypt via Synology or reverse proxy).

---

## Deployment checklist (quick, simple) ✅

- [ ] I can open `index.html` and see the page.
- [ ] Styles are applied (check `styles.css`).
- [ ] If there is JS, it works in the browser console.
- [ ] Files are in the Synology `web` folder (or Docker container) for hosting.

---

## How to fill this file (quick guide) ✍️

- Replace placeholders (like `BUILD_CMD`) with real commands if you add a build system later.
- If you later use Node/Vite/React, add the build and test commands under **Simple commands**.
- Add project-specific deploy steps in `DEPLOY.md` and update `DEPLOY_CMD` here.

---

## Examples of what you can ask the agent (use these) 📝

- "Make a simple `index.html` with my name and a hello message."
- "Add a blue header and center the text on the page."
- "Show me how to put the site on my Synology NAS using Web Station."

---

## Final notes 🌟

- Start tiny: one page, one stylesheet, one script. Then grow it.
- The agent will always explain things in easy words and ask before big changes.

If you'd like, I can also create starter files now (`index.html`, `styles.css`, `script.js`, `README.md`, `.env.example`, `DEPLOY.md`) and show how to preview the site locally. Say "Yes, create starters" to continue.
