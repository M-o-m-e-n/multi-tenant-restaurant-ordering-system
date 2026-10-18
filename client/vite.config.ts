import { cpSync, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// The API and sockets are proxied so the SPA and API share one origin in
// development, which the SameSite=Strict refresh cookie relies on (LLD §4.2).
// API_TARGET lets a second stack (the E2E run) proxy to its own API port;
// `vite preview` inherits this proxy.
const api = process.env.API_TARGET ?? 'http://localhost:4000';

/** The first paint of a tenant's page; a private tenant's comes from its site.json. */
interface Site {
  title: string;
  lang: string;
  dir: string;
  theme: string;
  /** Extra tags for <head>, such as the font faces its identity needs. */
  head?: string;
}

const FORK_AND_FLAME: Site = { title: 'Fork &amp; Flame', lang: 'en', dir: 'ltr', theme: 'dark' };

// Runs before the stylesheet paints, so a returning visitor never sees the other theme flash.
const STORED_THEME =
  "<script>try{var t=JSON.parse(localStorage.getItem('ros-theme')).state.theme;" +
  "if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}</script>";

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const SRC = fileURLToPath(new URL('./src', import.meta.url));
const PACKS = fileURLToPath(new URL('../tenants', import.meta.url));

/**
 * Where a tenant's code lives (ADR-032). Fork & Flame ships in src/; any
 * other tenant is a private pack checked out under tenants/<id>/, which this
 * repository ignores, so its code and photos never enter the public tree.
 */
function tenantDir(id: string): string | null {
  if (id === 'forkandflame') return null;
  const dir = join(PACKS, id);
  if (!existsSync(join(dir, 'client', 'index.ts'))) {
    throw new Error(
      `Tenant "${id}" not found: expected its pack at ${dir} (see tenants/README.md).`,
    );
  }
  return dir;
}

/**
 * One tenant per build (ADR-032). A pack's photos live in its assets/ folder,
 * served at /tenants/<id>/ and copied only into that tenant's build. The page
 * title, first-paint language and theme follow the tenant too.
 */
function tenant(id: string, dir: string | null): Plugin {
  const root = dir ? join(dir, 'assets') : '';
  const prefix = `/tenants/${id}/`;
  const head: Site = dir
    ? (JSON.parse(readFileSync(join(dir, 'site.json'), 'utf8')) as Site)
    : FORK_AND_FLAME;
  let outDir = 'dist';
  return {
    name: 'ros-tenant',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    transformIndexHtml(html) {
      return html
        .replace(
          '<html lang="en">',
          `<html lang="${head.lang}" dir="${head.dir}" data-tenant="${id}" data-theme="${head.theme}">`,
        )
        .replace(
          '</title>',
          `</title>
    ${STORED_THEME}${head.head ?? ''}`,
        )
        .replace(/<title>[^<]*<\/title>/, `<title>${head.title}</title>`);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!root) return next();
        const url = (req.url ?? '').split('?')[0] ?? '';
        if (!url.startsWith(prefix)) return next();
        const file = normalize(join(root, decodeURIComponent(url.slice(prefix.length))));
        if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
        res.end(readFileSync(file));
      });
    },
    closeBundle() {
      if (root && existsSync(root)) cpSync(root, join(outDir, 'tenants', id), { recursive: true });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const id = env.VITE_TENANT ?? process.env.VITE_TENANT ?? 'forkandflame';
  const dir = tenantDir(id);
  return {
    plugins: [react(), tenant(id, dir)],
    resolve: {
      alias: [
        // The built tenant's module (brand/types.ts `Tenant`).
        {
          find: /^@tenant$/,
          replacement: dir
            ? join(dir, 'client', 'index.ts')
            : join(SRC, 'tenants', 'forkandflame', 'index.ts'),
        },
        // How a pack's code imports the app's pieces.
        { find: /^@client\//, replacement: `${SRC}/` },
      ],
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': api,
        '/health': api,
        '/socket.io': { target: api, ws: true },
      },
    },
  };
});
