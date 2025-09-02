import fs from 'fs-extra';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

try {
    const pdfjsDistPath = path.dirname(require.resolve('pdfjs-dist/package.json'));
    const pdfWorkerPath = path.join(pdfjsDistPath, 'build', 'pdf.worker.min.mjs');
    const publicPath = path.join(process.cwd(), 'public');

    fs.ensureDirSync(publicPath);
    fs.copySync(pdfWorkerPath, path.join(publicPath, 'pdf.worker.min.mjs'));
    console.log('✅ Successfully copied pdf.worker.min.mjs to public directory.');
} catch (error) {
    console.error('❌ Error copying pdf.worker.min.mjs:', error);
}