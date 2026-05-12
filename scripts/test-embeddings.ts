import { embedText, embedBatch } from "../lib/ai/embeddings";

const dot = (a: number[], b: number[]) =>
  a.reduce((s, x, i) => s + x * b[i], 0);

const norm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));

async function main() {
  const [a, b, c, mn] = await Promise.all([
    embedText("machine learning algorithm"),
    embedText("ML model training"),
    embedText("бараг үгүй"),
    embedText("хиймэл оюун ухаан"),
  ]);

  const en = await embedText("artificial intelligence");

  console.log("1. Normalization (expect ~1.0):", norm(a).toFixed(6));
  console.log("2. Similar EN-EN (expect >0.7): ", dot(a, b).toFixed(4));
  console.log("3. Different EN-MN (expect <0.4):", dot(a, c).toFixed(4));
  console.log("4. Multilingual EN-MN (expect >0.5):", dot(en, mn).toFixed(4));

  const batch = await embedBatch(["machine learning algorithm", "ML model training"]);
  const diff = a.reduce((s, x, i) => s + Math.abs(x - batch[0][i]), 0);
  console.log("5. Batch vs single diff (expect ~0):", diff.toFixed(8));
}

main();
