/**
 * Safe pdf-parse wrapper for Next.js (Turbopack compatible)
 */

const mod = require("pdf-parse");

// 🔑 pdf-parse sometimes exports { default: fn }
const pdfParse =
  typeof mod === "function"
    ? mod
    : typeof mod.default === "function"
    ? mod.default
    : null;

if (!pdfParse) {
  throw new Error("pdf-parse did not export a function");
}

module.exports = async function parsePdf(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error("Expected Buffer");
  }

  const data = await pdfParse(buffer);
  return data;
};
