/**
 * Packages the production build into Curious Reader's Layout A ZIPs:
 * a core engine ZIP (dist/, minus lang/) and one language-pack ZIP per
 * lang/<code> directory. Run `pnpm build` first.
 *
 * Output goes to dist-bundles/ (not inside dist/ itself) so the zip files
 * never try to include themselves mid-stream.
 */
import { createWriteStream, existsSync, readdirSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import archiver from 'archiver'

const ROOT = path.resolve(import.meta.dirname, '..')
const DIST = path.join(ROOT, 'dist')
const OUT_DIR = path.join(ROOT, 'dist-bundles')

function zipDirectory(sourceDir: string, outFile: string, options: { ignore?: string[]; destPrefix?: string } = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    mkdirSync(path.dirname(outFile), { recursive: true })
    const output = createWriteStream(outFile)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => resolve())
    archive.on('error', reject)
    archive.pipe(output)

    if (options.destPrefix) {
      archive.directory(sourceDir, options.destPrefix)
    } else {
      archive.glob('**/*', { cwd: sourceDir, ignore: options.ignore ?? [] })
    }

    void archive.finalize()
  })
}

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

async function main() {
  if (!existsSync(DIST)) {
    console.error('dist/ not found. Run `pnpm build` first.')
    process.exit(1)
  }

  mkdirSync(OUT_DIR, { recursive: true })

  const coreZip = path.join(OUT_DIR, 'drag-into-place-core.zip')
  console.log('Packaging core bundle (dist/, excluding lang/)...')
  await zipDirectory(DIST, coreZip, { ignore: ['lang/**'] })
  console.log(`  -> ${coreZip} (${formatSize(statSync(coreZip).size)})`)

  const langDir = path.join(DIST, 'lang')
  if (existsSync(langDir)) {
    for (const code of readdirSync(langDir)) {
      const codeDir = path.join(langDir, code)
      if (!statSync(codeDir).isDirectory()) continue
      const langZip = path.join(OUT_DIR, `drag-into-place-lang-${code}.zip`)
      console.log(`Packaging language bundle for "${code}"...`)
      await zipDirectory(codeDir, langZip, { destPrefix: `lang/${code}` })
      console.log(`  -> ${langZip} (${formatSize(statSync(langZip).size)})`)
    }
  } else {
    console.warn('No lang/ directory found in dist/; skipping language bundles.')
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
