# Vortex staging deployment (Hostinger VPS)

This branch is an isolated **frontend-only staging preparation**. It does not migrate the Supabase database, auth users, storage, secrets, Edge Functions or cron jobs. Do not point production DNS to this service.

## Safety
- Existing 9Router and Traefik containers are not modified.
- Compose does not publish ports or attach to the existing Traefik network.
- Never paste database passwords, service-role keys or other secrets into VITE_* variables. VITE_* values are embedded in the browser bundle.
- Obtain a **separate staging Supabase project** before testing any workflows that write data.
- A GitHub URL is not a Docker image: Hostinger's Compose editor cannot build this repo unless a build context exists on the VPS. Build from a checked-out copy on the VPS, or publish an image to a registry and replace the build stanza with image:.
- Lovable OAuth, MCP and preview integrations require separate review and may not work outside Lovable.

## Next steps (not performed)
1. Review Hostinger VPS capacity, backups, Docker networks and existing applications.
2. Identify ownership and export access for the source database. Take verified, restorable backups including auth, storage, functions and secrets inventory.
3. Create a dedicated staging backend and obtain only its public URL and publishable key.
4. Build and validate the frontend image in an isolated staging environment.
5. Configure a dedicated staging hostname in Traefik only after reviewing the existing routing setup.
6. Run tests before planning production cutover.

## Build
The build requires Node.js and uses npm install with the repository's package.json and bun.lock. For reproducible installs, consider standardizing on one lockfile and a frozen install after testing. This initial Dockerfile is a preparation artifact, not a verified production image.
