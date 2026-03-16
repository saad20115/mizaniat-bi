const fs = require('fs');
const mainFile = 'd:/mizaniat/client/js/pages/presentation.js';
const sectionFile = 'd:/mizaniat/_redist_section.js';

const lines = fs.readFileSync(mainFile, 'utf8').split('\n');
const section = fs.readFileSync(sectionFile, 'utf8');

// Find the line containing "TAB: REDISTRIBUTION" comment (the start marker)
let redistStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('TAB: REDISTRIBUTION')) {
    redistStart = i;
    break;
  }
}

// Find the line containing "TAB: GUARANTEES" or "renderGuarantees" AFTER the redistribution section
let guarStart = -1;
for (let i = redistStart + 1; i < lines.length; i++) {
  if (lines[i].includes('renderGuarantees')) {
    // Go back to find the comment line before it
    for (let j = i - 1; j >= redistStart; j--) {
      if (lines[j].includes('TAB: GUARANTEES') || lines[j].includes('GUARANTEES')) {
        guarStart = j;
        break;
      }
    }
    if (guarStart < 0) guarStart = i; // fallback: just use the function line
    break;
  }
}

console.log('redistStart:', redistStart + 1, 'guarStart:', guarStart + 1, 'totalLines:', lines.length);

if (redistStart < 0 || guarStart < 0) {
  console.error('MARKERS NOT FOUND');
  process.exit(1);
}

// Build new file: everything before redistStart + new section + everything from guarStart onwards
const before = lines.slice(0, redistStart);
const after = lines.slice(guarStart);
const newContent = [...before, ...section.split('\n'), '', ...after].join('\n');

fs.writeFileSync(mainFile, newContent, 'utf8');
console.log('Done. New total lines:', newContent.split('\n').length);
