import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      yield path;
    }
  }
}

async function fixImports() {
  for await (const file of walk('src')) {
    let content = await readFile(file, 'utf-8');
    const original = content;

    // Fix relative imports: add .js extension
    // Match: from './xxx' or from '../xxx' but not already .js
    content = content.replace(/from\s+['"](\.\.[\/\w\-\.]+)['"](?!\.js)/g, "from '$1.js'");
    content = content.replace(/from\s+['"](\.[\/\w\-\.]+)['"](?!\.js)/g, "from '$1.js'");

    // Remove any double .js.js extensions
    content = content.replace(/\.js\.js'/g, ".js'");
    content = content.replace(/\.js\.js"/g, '.js"');

    if (content !== original) {
      await writeFile(file, content, 'utf-8');
      console.log(`Fixed: ${file}`);
    }
  }
  console.log('Done!');
}

fixImports().catch(console.error);
