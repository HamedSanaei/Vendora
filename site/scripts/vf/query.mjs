// Query measurements: prints selected elements' geometry/styles.
// Usage: node scripts/vf/query.mjs <json> <queryFile.mjs>
import { readFileSync } from "node:fs";
const data = JSON.parse(readFileSync(process.argv[2], "utf8"));
const { run } = await import(`file://${process.cwd()}/${process.argv[3]}`);
run(data, (label, e) =>
  console.log(
    `${label.padEnd(34)} x=${String(e?.x).padEnd(6)} y=${String(e?.y).padEnd(6)} w=${String(e?.w).padEnd(7)} h=${String(e?.h).padEnd(6)} fs=${e?.fs} fw=${e?.fw} lh=${e?.lh} br=${e?.br} bg=${e?.bg} bc=${e?.bc}/${e?.bw} ff=${e?.ff}`,
  ),
);
