# DEPLOY.md — How to put this site on your Synology NAS (beginner-friendly)

This file explains two easy ways to host the static site on a Synology NAS.

Option A — Web Station (easiest for static sites)

1. Open Synology Package Center and install **Web Station**.
2. Create or use the `web` shared folder (usually at `/volume1/web`).
3. Copy the files from this project into a folder inside `web`, for example `/volume1/web/my-site`.
4. In **Web Station**, add a **Virtual Host** with the document root set to your `/volume1/web/my-site` folder.
5. On a machine in your network, open `http://<your-nas-ip>/my-site/` to check it.

Notes:

- If you want the site to be visible from the internet, configure your router and Synology firewall carefully and consider using HTTPS (Synology supports Let's Encrypt).

Option B — Docker (useful if you want Nginx or more control)

1. Install **Docker** from Package Center.
2. Put your site into a folder on the NAS (for example `/volume1/docker/my-site`), or map your source folder.
3. Run an nginx container that serves the folder, for example (replace paths and ports):

   docker run -d --name my-static-site -p 8080:80 \
    -v /volume1/docker/my-site:/usr/share/nginx/html:ro \
    nginx:alpine

4. Open `http://<your-nas-ip>:8080/` to see the site.

Security & extras

- Keep a copy of your site locally and/or use version control (git) for changes.
- Use HTTPS when exposing the site to the internet. Synology can help with certificates.

If you want, I can add a small script that rsyncs files to your NAS (if you prefer that workflow). Ask me to add it and provide the path on your NAS.
