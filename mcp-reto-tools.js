/**
 * MCP Server para el proyecto R.E.T.O. (CommonJS)
 * Herramientas específicas para este proyecto de aprendizaje estático
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = 'C:\\Users\\Jorge\\Downloads\\R_E_T_O_gemini_estatico-js\\R.E.T.O_gemini';

const server = new Server(
  { name: 'reto-tools', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'run_tests',
      description: 'Ejecuta todas las pruebas del proyecto (paridad, conexión, etc.)',
      inputSchema: { type: 'object', properties: {}, required: [] }
    },
    {
      name: 'run_specific_test',
      description: 'Ejecuta una prueba específica por nombre',
      inputSchema: {
        type: 'object',
        properties: { testName: { type: 'string', description: 'Nombre del test (ej: paridad_salas, paridad_rpg, conexion)' } },
        required: ['testName']
      }
    },
    {
      name: 'generate_indices',
      description: 'Regenera índices de archivos (ejemplos, fondos, sprites, powerups)',
      inputSchema: { type: 'object', properties: {}, required: [] }
    },
    {
      name: 'start_dev_server',
      description: 'Inicia servidor de desarrollo local (puerto 8000)',
      inputSchema: { type: 'object', properties: {}, required: [] }
    },
    {
      name: 'deploy_worker',
      description: 'Despliega el signaling worker a Cloudflare (requiere wrangler configurado)',
      inputSchema: { type: 'object', properties: {}, required: [] }
    },
    {
      name: 'check_git_status',
      description: 'Muestra estado de git y cambios pendientes',
      inputSchema: { type: 'object', properties: {}, required: [] }
    },
    {
      name: 'create_pr',
      description: 'Crea un PR en GitHub (requiere gh CLI autenticado)',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          base: { type: 'string', default: 'main' }
        },
        required: ['title']
      }
    },
    {
      name: 'validate_html',
      description: 'Valida que las páginas HTML carguen recursos existentes',
      inputSchema: { type: 'object', properties: {}, required: [] }
    },
    {
      name: 'build_for_github_pages',
      description: 'Prepara el sitio para GitHub Pages (copia a _site, genera version.txt)',
      inputSchema: { type: 'object', properties: {}, required: [] }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'run_tests': {
        const output = execSync('node tests/run-all.js', {
          cwd: PROJECT_ROOT,
          encoding: 'utf8',
          maxBuffer: 1024 * 1024
        });
        return { content: [{ type: 'text', text: output }] };
      }

      case 'run_specific_test': {
        const testFile = path.join(PROJECT_ROOT, 'tests', `${args.testName}.test.js`);
        if (!fs.existsSync(testFile)) {
          return { content: [{ type: 'text', text: `Test no encontrado: ${args.testName}` }] };
        }
        const output = execSync(`node ${testFile}`, {
          cwd: PROJECT_ROOT,
          encoding: 'utf8',
          maxBuffer: 1024 * 1024
        });
        return { content: [{ type: 'text', text: output }] };
      }

      case 'generate_indices': {
        const output = execSync('node tools/generar-indices.js', {
          cwd: PROJECT_ROOT,
          encoding: 'utf8',
          maxBuffer: 1024 * 1024
        });
        return { content: [{ type: 'text', text: output }] };
      }

      case 'start_dev_server': {
        const child = spawn('node', ['tools/servir.js'], {
          cwd: PROJECT_ROOT,
          detached: true,
          stdio: 'ignore'
        });
        child.unref();
        return { content: [{ type: 'text', text: 'Servidor de desarrollo iniciado en http://localhost:8000' }] };
      }

      case 'deploy_worker': {
        try {
          const output = execSync('npx wrangler deploy signaling-worker.js', {
            cwd: PROJECT_ROOT,
            encoding: 'utf8',
            maxBuffer: 1024 * 1024
          });
          return { content: [{ type: 'text', text: output }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Error deployando worker: ${e.message}\nAsegúrate de tener wrangler configurado (wrangler login)` }] };
        }
      }

      case 'check_git_status': {
        const output = execSync('git status', {
          cwd: PROJECT_ROOT,
          encoding: 'utf8'
        });
        return { content: [{ type: 'text', text: output }] };
      }

      case 'create_pr': {
        try {
          const output = execSync(`gh pr create --title "${args.title}" --body "${args.body || ''}" --base "${args.base || 'main'}"`, {
            cwd: PROJECT_ROOT,
            encoding: 'utf8'
          });
          return { content: [{ type: 'text', text: output }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Error creando PR: ${e.message}\nRequiere gh CLI autenticado (gh auth login)` }] };
        }
      }

      case 'validate_html': {
        const output = execSync('node tests/run-all.js', {
          cwd: PROJECT_ROOT,
          encoding: 'utf8',
          maxBuffer: 1024 * 1024
        });
        const lines = output.split('\n').filter(l => l.includes('✘') || l.includes('problema'));
        return { content: [{ type: 'text', text: lines.join('\n') || 'Sin problemas detectados' }] };
      }

      case 'build_for_github_pages': {
        const siteDir = path.join(PROJECT_ROOT, '_site');
        if (fs.existsSync(siteDir)) {
          fs.rmSync(siteDir, { recursive: true });
        }
        fs.mkdirSync(siteDir);
        
        const dirs = ['categorias', 'datos', 'ejemplos', 'imagenes', 'pwa', 'scripts', 'sonidos', 'styles'];
        for (const d of dirs) {
          const src = path.join(PROJECT_ROOT, d);
          const dst = path.join(siteDir, d);
          if (fs.existsSync(src)) {
            copyRecursive(src, dst);
          }
        }
        
        const files = ['index.html', 'sw.js', 'manifest.webmanifest'];
        for (const f of files) {
          const src = path.join(PROJECT_ROOT, f);
          if (fs.existsSync(src)) fs.copyFileSync(src, path.join(siteDir, f));
        }
        
        const versionTxt = `commit: ${execSync('git rev-parse HEAD', { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim()}\n` +
          `mensaje: ${execSync('git log -1 --pretty=%s', { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim()}\n` +
          `fecha: ${new Date().toISOString()}\n`;
        fs.writeFileSync(path.join(siteDir, 'version.txt'), versionTxt);
        
        return { content: [{ type: 'text', text: `Sitio preparado en _site/ (${fs.readdirSync(siteDir).length} archivos)` }] };
      }

      default:
        throw new Error(`Herramienta desconocida: ${name}`);
    }
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
  }
});

function copyRecursive(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('R.E.T.O. MCP server running on stdio');
}

main().catch(console.error);