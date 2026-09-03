/**
 * Generates placeholder word images (PNG) and placeholder audio (WAV) so the
 * game is fully playable before real art/recordings are supplied.
 *
 * Images: solid-color square with the word rendered as text, via raw PNG
 * encoding (no canvas dependency needed on Node).
 * Audio: short sine-tone WAV files (distinct pitch per category) using a
 * minimal PCM WAV writer. No native/ffmpeg dependency required.
 *
 * Real MP3 encoding needs a native/ffmpeg dependency this project doesn't
 * pull in; WAV is natively decodable by Web Audio API's decodeAudioData,
 * so it's a functionally equivalent stand-in. See README for the note on
 * swapping in real assets.
 */
import { createWriteStream, mkdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { deflateSync } from 'node:zlib'
import type { Word } from '../src/types/word.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const WORDS_JSON = path.join(ROOT, 'public/lang/english/data/words.json')
const IMAGES_DIR = path.join(ROOT, 'public/assets/images')
const AUDIO_DIR = path.join(ROOT, 'public/lang/english/audios')

const IMAGE_SIZE = 300

// --- Minimal PNG encoder (uncompressed-friendly, single IDAT via zlib deflate) ---

function crc32(buf: Buffer): number {
  let c: number
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c
    }
    return t
  })())
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}
namespace crc32 {
  export let table: Uint32Array | undefined
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

/** Encodes an RGB pixel grid (row-major, [r,g,b] tuples) as a PNG buffer. */
function encodePng(width: number, height: number, pixels: [number, number, number][]): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: RGB
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const raw = Buffer.alloc(height * (1 + width * 3))
  let offset = 0
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0 // filter type: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixels[y * width + x]
      raw[offset++] = r
      raw[offset++] = g
      raw[offset++] = b
    }
  }
  const idat = deflateSync(raw)

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// 3x5 pixel-font glyphs for A-Z, 0-9 and a few punctuation (uppercase only, enough for word labels)
const GLYPHS: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['#.#', '##.', '#.#', '.##', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '.##', '..#'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
}

function pickColor(seed: number): [number, number, number] {
  // Deterministic pastel palette per word, so re-runs are stable.
  const palette: [number, number, number][] = [
    [255, 214, 165], [173, 216, 230], [200, 230, 201], [255, 236, 179],
    [225, 190, 231], [255, 205, 210], [178, 235, 242], [220, 237, 200],
  ]
  return palette[seed % palette.length]
}

function generateWordImage(word: string, seed: number): Buffer {
  const bg = pickColor(seed)
  const fg: [number, number, number] = [42, 42, 42]
  const pixels: [number, number, number][] = new Array(IMAGE_SIZE * IMAGE_SIZE).fill(bg)

  // Border frame
  for (let x = 0; x < IMAGE_SIZE; x++) {
    for (const y of [0, 1, IMAGE_SIZE - 2, IMAGE_SIZE - 1]) {
      pixels[y * IMAGE_SIZE + x] = fg
    }
  }
  for (let y = 0; y < IMAGE_SIZE; y++) {
    for (const x of [0, 1, IMAGE_SIZE - 2, IMAGE_SIZE - 1]) {
      pixels[y * IMAGE_SIZE + x] = fg
    }
  }

  // Draw the word centered, large blocky glyphs
  const letters = word.toUpperCase().split('')
  const glyphW = 3
  const glyphH = 5
  const scale = 12
  const gap = 2 * scale
  const totalWidth = letters.length * (glyphW * scale + gap) - gap
  const startX = Math.floor((IMAGE_SIZE - totalWidth) / 2)
  const startY = Math.floor((IMAGE_SIZE - glyphH * scale) / 2)

  letters.forEach((letter, li) => {
    const glyph = GLYPHS[letter]
    if (!glyph) return
    const originX = startX + li * (glyphW * scale + gap)
    for (let gy = 0; gy < glyphH; gy++) {
      for (let gx = 0; gx < glyphW; gx++) {
        if (glyph[gy][gx] !== '#') continue
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = originX + gx * scale + sx
            const py = startY + gy * scale + sy
            if (px >= 0 && px < IMAGE_SIZE && py >= 0 && py < IMAGE_SIZE) {
              pixels[py * IMAGE_SIZE + px] = fg
            }
          }
        }
      }
    }
  })

  return encodePng(IMAGE_SIZE, IMAGE_SIZE, pixels)
}

// --- Minimal WAV encoder: mono 16-bit PCM sine tone ---

function generateToneWav(frequencyHz: number, durationSec: number): Buffer {
  const sampleRate = 22050
  const numSamples = Math.floor(sampleRate * durationSec)
  const dataSize = numSamples * 2 // 16-bit mono

  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8, 'ascii')
  buffer.write('fmt ', 12, 'ascii')
  buffer.writeUInt32LE(16, 16) // fmt chunk size
  buffer.writeUInt16LE(1, 20) // PCM
  buffer.writeUInt16LE(1, 22) // mono
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28) // byte rate
  buffer.writeUInt16LE(2, 32) // block align
  buffer.writeUInt16LE(16, 34) // bits per sample
  buffer.write('data', 36, 'ascii')
  buffer.writeUInt32LE(dataSize, 40)

  for (let i = 0; i < numSamples; i++) {
    // Fade in/out to avoid clicks
    const t = i / sampleRate
    const envelope = Math.min(1, t * 40) * Math.min(1, (durationSec - t) * 40)
    const sample = Math.sin(2 * Math.PI * frequencyHz * t) * envelope * 0.3
    buffer.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(sample * 32767))), 44 + i * 2)
  }

  return buffer
}

/** A short downward pitch-sweep ("boing"), distinct from the flat feedback tones. */
function generateBounceWav(durationSec: number): Buffer {
  const sampleRate = 22050
  const numSamples = Math.floor(sampleRate * durationSec)
  const dataSize = numSamples * 2

  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8, 'ascii')
  buffer.write('fmt ', 12, 'ascii')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36, 'ascii')
  buffer.writeUInt32LE(dataSize, 40)

  const startFreq = 500
  const endFreq = 180
  let phase = 0
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const progress = t / durationSec
    const freq = startFreq + (endFreq - startFreq) * progress
    phase += (2 * Math.PI * freq) / sampleRate
    const envelope = Math.min(1, t * 60) * Math.min(1, (durationSec - t) * 20)
    const sample = Math.sin(phase) * envelope * 0.3
    buffer.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(sample * 32767))), 44 + i * 2)
  }

  return buffer
}

// Distinct, deterministic pitch per letter so playback is at least
// distinguishable during manual QA, even though it isn't real speech.
function letterFrequency(letter: string): number {
  const base = 220
  const offset = (letter.toLowerCase().charCodeAt(0) - 97) * 15
  return base + offset
}

async function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true })
}

async function writeFile(filePath: string, data: Buffer): Promise<void> {
  await ensureDir(path.dirname(filePath))
  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(filePath)
    stream.on('error', reject)
    stream.on('finish', () => resolve())
    stream.end(data)
  })
}

async function main() {
  const words: Word[] = JSON.parse(await readFile(WORDS_JSON, 'utf-8'))

  console.log(`Generating placeholder images for ${words.length} words...`)
  for (const [i, word] of words.entries()) {
    const png = generateWordImage(word.target_word, i)
    await writeFile(path.join(IMAGES_DIR, `${word.target_word}.png`), png)
  }

  console.log('Generating placeholder word/letter/feedback/celebration audio...')
  const lettersSeen = new Set<string>()
  for (const word of words) {
    const wordTone = generateToneWav(330, 0.5)
    await writeFile(path.join(AUDIO_DIR, 'words', `${word.target_word}.wav`), wordTone)

    for (const letter of word.letters) {
      if (lettersSeen.has(letter)) continue
      lettersSeen.add(letter)
      const tone = generateToneWav(letterFrequency(letter), 0.35)
      await writeFile(path.join(AUDIO_DIR, 'letters', `${letter}.wav`), tone)
    }
  }

  await writeFile(path.join(AUDIO_DIR, 'feedback', 'correct.wav'), generateToneWav(880, 0.25))
  await writeFile(path.join(AUDIO_DIR, 'feedback', 'incorrect.wav'), generateToneWav(150, 0.3))
  await writeFile(path.join(AUDIO_DIR, 'feedback', 'bounce.wav'), generateBounceWav(0.25))
  await writeFile(path.join(AUDIO_DIR, 'celebration', 'victory.wav'), generateToneWav(660, 1.0))

  console.log(`Done. Wrote images to ${IMAGES_DIR} and audio to ${AUDIO_DIR}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
