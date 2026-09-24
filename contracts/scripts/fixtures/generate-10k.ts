/**
 * generate-10k.ts — Phase 3 Fixture Generator
 *
 * Sinh 10.000 sinh viên giả lập với đầy đủ PII cho stress test pipeline.
 * Output: fixtures/graduation-2026.csv
 *
 * Dữ liệu sinh viên bao gồm:
 * - Họ tên (tiếng Việt, tổ hợp thực tế)
 * - MSSV (7 chữ số, prefix theo khoa)
 * - Ngày sinh (1999-2004)
 * - Ngành học (8 ngành CSE/EE/ME/CE...)
 * - Xếp loại tốt nghiệp
 * - GPA (2.0 - 4.0)
 *
 * Sử dụng:
 *   npx ts-node scripts/fixtures/generate-10k.ts
 *   npx ts-node scripts/fixtures/generate-10k.ts --count=500
 *
 * @see SPEC.md §3 — Credential JSON Schema
 * @see PHASE3-KE-HOACH-EIP712-TRUST-ANCHOR.md Tuần 5
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ─── Configuration ──────────────────────────────────────────

const DEFAULT_COUNT = 10_000;
const BATCH_ID = "GRAD-2026-01";
const OUTPUT_DIR = path.resolve(__dirname, "../../fixtures");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "graduation-2026.csv");

// Parse --count argument
const countArg = process.argv.find((a) => a.startsWith("--count="));
const COUNT = countArg ? parseInt(countArg.split("=")[1], 10) : DEFAULT_COUNT;

// Deterministic seed for reproducibility
const SEED = "bkcred-phase3-graduation-2026";

// ─── Vietnamese Name Data ───────────────────────────────────

const FAMILY_NAMES = [
  "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ",
  "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý",
  "Trương", "Lương", "Đinh", "Mai", "Tô", "Tạ", "Cao", "Lâm",
];

const MIDDLE_NAMES = [
  "Văn", "Thị", "Hữu", "Đức", "Minh", "Thanh", "Ngọc", "Quốc",
  "Anh", "Hoàng", "Phương", "Thành", "Xuân", "Kim", "Bảo", "Trung",
  "Hồng", "Tuấn", "Thiện", "Quang",
];

const GIVEN_NAMES = [
  "An", "Bình", "Cường", "Dũng", "Đạt", "Giang", "Hải", "Hùng",
  "Khoa", "Linh", "Long", "Minh", "Nam", "Phát", "Quân", "Sơn",
  "Tâm", "Thắng", "Trí", "Tú", "Tuấn", "Vinh", "Vũ", "Yến",
  "Hà", "Hiền", "Hương", "Lan", "Mai", "Ngân", "Nhung", "Phượng",
  "Quyên", "Thảo", "Trang", "Trinh", "Uyên", "Vy", "Xuân", "Châu",
  "Duyên", "Hạnh", "Khánh", "Lộc", "Nghĩa", "Phúc", "Thiên", "Trọng",
];

// ─── Academic Data ──────────────────────────────────────────

interface Program {
  code: string;
  name: string;
  vct: string;
  prefix: number; // MSSV prefix (2 digits representing faculty)
}

const PROGRAMS: Program[] = [
  { code: "CSE", name: "Kỹ sư Khoa học Máy tính", vct: "BKISC_DEGREE", prefix: 19 },
  { code: "EE",  name: "Kỹ sư Điện - Điện tử", vct: "BKISC_DEGREE", prefix: 20 },
  { code: "ME",  name: "Kỹ sư Cơ khí", vct: "BKISC_DEGREE", prefix: 21 },
  { code: "CE",  name: "Kỹ sư Xây dựng", vct: "BKISC_DEGREE", prefix: 22 },
  { code: "CHE", name: "Kỹ sư Kỹ thuật Hoá học", vct: "BKISC_DEGREE", prefix: 23 },
  { code: "IE",  name: "Kỹ sư Kỹ thuật Công nghiệp", vct: "BKISC_DEGREE", prefix: 24 },
  { code: "ENV", name: "Kỹ sư Kỹ thuật Môi trường", vct: "BKISC_DEGREE", prefix: 25 },
  { code: "MTR", name: "Kỹ sư Kỹ thuật Vật liệu", vct: "BKISC_DEGREE", prefix: 26 },
];

// Honors distribution (approximate real university proportions)
const HONORS_DISTRIBUTION: { label: string; weight: number }[] = [
  { label: "Xuất sắc", weight: 3 },   //  3%
  { label: "Giỏi",     weight: 15 },  // 15%
  { label: "Khá",      weight: 52 },  // 52%
  { label: "",          weight: 30 },  // 30% — no honors (Trung bình)
];

// ─── Helpers ────────────────────────────────────────────────

/**
 * Deterministic PRNG using crypto.createHash for reproducibility.
 * Each call to next() hashes the current counter with the seed.
 * Much faster than xorshift for UUID generation — 1 hash per record.
 */
class DeterministicRNG {
  private counter: number = 0;
  private seed: string;
  private buffer: Buffer | null = null;
  private bufferOffset: number = 0;

  constructor(seed: string) {
    this.seed = seed;
  }

  /** Get next 32 bytes of randomness */
  private refill(): void {
    this.buffer = crypto
      .createHash("sha256")
      .update(`${this.seed}:${this.counter++}`)
      .digest();
    this.bufferOffset = 0;
  }

  /** Get a float in [0, 1) */
  next(): number {
    if (!this.buffer || this.bufferOffset >= 28) {
      this.refill();
    }
    const val = this.buffer!.readUInt32BE(this.bufferOffset);
    this.bufferOffset += 4;
    return val / 4294967296;
  }

  /** Random integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Pick random element from array */
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Pick weighted */
  pickWeighted<T extends { weight: number }>(arr: T[]): T {
    const totalWeight = arr.reduce((sum, item) => sum + item.weight, 0);
    let rand = this.next() * totalWeight;
    for (const item of arr) {
      rand -= item.weight;
      if (rand <= 0) return item;
    }
    return arr[arr.length - 1];
  }

  /** Generate a deterministic UUID v4 */
  uuid(): string {
    if (!this.buffer || this.bufferOffset >= 16) {
      this.refill();
    }
    // Use 16 bytes from buffer
    const bytes = Buffer.alloc(16);
    this.buffer!.copy(bytes, 0, this.bufferOffset, this.bufferOffset + 16);
    this.bufferOffset += 16;

    // Set version (4) and variant (10xx)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = bytes.toString("hex");
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join("-");
  }
}

function generateDOB(rng: DeterministicRNG): string {
  const year = rng.int(1999, 2004);
  const month = rng.int(1, 12);
  const maxDay = new Date(year, month, 0).getDate();
  const day = rng.int(1, maxDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function generateGPA(rng: DeterministicRNG, honors: string): number {
  let min: number, max: number;
  switch (honors) {
    case "Xuất sắc": min = 3.6; max = 4.0; break;
    case "Giỏi":     min = 3.2; max = 3.59; break;
    case "Khá":      min = 2.5; max = 3.19; break;
    default:         min = 2.0; max = 2.49; break;
  }
  const gpa = min + rng.next() * (max - min);
  return Math.round(gpa * 100) / 100;
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ─── Main Generator ─────────────────────────────────────────

function generate(count: number): void {
  const startTime = Date.now();
  const rng = new DeterministicRNG(SEED);

  console.log(`\n🎓 BK Credential — Fixture Generator (Phase 3)`);
  console.log(`   Generating ${count.toLocaleString()} students...`);
  console.log(`   Batch ID: ${BATCH_ID}`);
  console.log(`   Seed: "${SEED}" (deterministic)\n`);

  // CSV Header
  const headers = [
    "index",
    "credId",
    "fullName",
    "studentId",
    "dob",
    "programCode",
    "degreeTitle",
    "vct",
    "graduationDate",
    "honors",
    "gpa",
    "batchId",
  ];

  const rows: string[] = [headers.join(",")];

  // Pre-generate unique student IDs using sequential approach
  // Each program gets a sequential block: prefix + 10001, 10002, ...
  const programCounters: Record<number, number> = {};
  for (const p of PROGRAMS) {
    programCounters[p.prefix] = 10001; // Start from 10001
  }

  for (let i = 0; i < count; i++) {
    // Pick program
    const program = rng.pick(PROGRAMS);

    // Sequential student ID — guaranteed unique, no collision
    const seqNum = programCounters[program.prefix]++;
    const studentId = `${program.prefix}${seqNum}`;

    // Deterministic credId (URN UUID)
    const credId = `urn:uuid:${rng.uuid()}`;

    // Generate name
    const fullName = `${rng.pick(FAMILY_NAMES)} ${rng.pick(MIDDLE_NAMES)} ${rng.pick(GIVEN_NAMES)}`;

    // Generate DOB
    const dob = generateDOB(rng);

    // Honors & GPA
    const honorsEntry = rng.pickWeighted(HONORS_DISTRIBUTION);
    const honors = honorsEntry.label;
    const gpa = generateGPA(rng, honors);

    // Fixed graduation date
    const graduationDate = "2026-06-15";

    // Build CSV row
    const row = [
      i,
      escapeCSV(credId),
      escapeCSV(fullName),
      studentId,
      dob,
      program.code,
      escapeCSV(program.name),
      program.vct,
      graduationDate,
      escapeCSV(honors),
      gpa.toFixed(2),
      BATCH_ID,
    ].join(",");

    rows.push(row);

    // Progress
    if ((i + 1) % 2000 === 0) {
      console.log(`   ✓ ${(i + 1).toLocaleString()} / ${count.toLocaleString()}`);
    }
  }

  // Write output
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const csvContent = rows.join("\n") + "\n";
  fs.writeFileSync(OUTPUT_FILE, csvContent, "utf-8");

  // Stats
  const elapsed = Date.now() - startTime;
  const fileSize = Buffer.byteLength(csvContent, "utf-8");

  console.log(`\n✅ Done in ${elapsed}ms`);
  console.log(`   Output: ${OUTPUT_FILE}`);
  console.log(`   Records: ${count.toLocaleString()}`);
  console.log(`   File size: ${(fileSize / 1024).toFixed(1)} KB`);

  // Distribution summary
  console.log(`\n📊 Honors distribution:`);
  const honorsCounts: Record<string, number> = {};
  const programCounts: Record<string, number> = {};

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split(",");
    const h = cols[9]?.replace(/"/g, "") || "Trung bình";
    const p = cols[5] || "?";
    honorsCounts[h || "Trung bình"] = (honorsCounts[h || "Trung bình"] || 0) + 1;
    programCounts[p] = (programCounts[p] || 0) + 1;
  }

  for (const [label, c] of Object.entries(honorsCounts).sort((a, b) => b[1] - a[1])) {
    const pct = ((c / count) * 100).toFixed(1);
    console.log(`   ${label.padEnd(12)} ${c.toLocaleString().padStart(6)}  (${pct}%)`);
  }

  console.log(`\n🏛️  Program distribution:`);
  for (const [code, c] of Object.entries(programCounts).sort((a, b) => b[1] - a[1])) {
    const pct = ((c / count) * 100).toFixed(1);
    console.log(`   ${code.padEnd(5)} ${c.toLocaleString().padStart(6)}  (${pct}%)`);
  }
}

// ─── Run ────────────────────────────────────────────────────

generate(COUNT);
