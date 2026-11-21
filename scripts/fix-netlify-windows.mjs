import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const generatedModule = resolve(
  ".netlify/edge-functions/___netlify-edge-handler-node-middleware/edge-runtime/lib/cjs.ts",
);
const original = "pathToFileURL(filepath, { windows: false })";
const normalized =
  'pathToFileURL(filepath.replace(/^[A-Za-z]:\\//, "/$&"), { windows: false })';

const source = await readFile(generatedModule, "utf8");
if (!source.includes(original) && !source.includes(normalized)) {
  throw new Error(
    "Netlify 适配器生成代码已变化，请重新核对 Windows 路径修复。",
  );
}
await writeFile(generatedModule, source.replace(original, normalized));
console.log("已规范化 Netlify 生成代码中的 Windows 文件 URL。");
