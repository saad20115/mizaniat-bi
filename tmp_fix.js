const fs = require('fs');
let code = fs.readFileSync('d:/mizaniat/client/js/pages/presentation.js', 'utf8');
const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("const label = Math.abs(val) >= 1e6 ? (val / 1e6).toFixed(1) + 'M'")) {
    lines[i] = "      const label = data.exactValues ? new Intl.NumberFormat('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}).format(val) : (Math.abs(val) >= 1e6 ? (val / 1e6).toFixed(1) + 'M' : (Math.abs(val) >= 1e3 ? Math.round(val / 1e3) + 'K' : formatNumber(val, 0)));";
  }
}
fs.writeFileSync('d:/mizaniat/client/js/pages/presentation.js', lines.join('\n'));
