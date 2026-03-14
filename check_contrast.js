const fs = require('fs');
const path = require('path');

const problematic = [
  'text-slate-200', 'text-slate-300', 'text-slate-400', 'text-slate-50',
  'bg-slate-900', 'bg-slate-800', 'bg-slate-950', 'bg-slate-700',
  'text-white', 'bg-black'
];

function checkDir(dir) {
  let issues = 0;
  fs.readdirSync(dir).forEach(f => {
    let filePath = path.join(dir, f);
    if(fs.statSync(filePath).isDirectory()) {
      issues += checkDir(filePath);
    } else if (filePath.endsWith('.tsx')) {
      let content = fs.readFileSync(filePath, 'utf8');
      problematic.forEach(p => {
        if(content.includes(p)) {
          console.log(`Found ${p} in ${filePath}`);
          issues++;
        }
      });
    }
  });
  return issues;
}
const count = checkDir(path.join(__dirname, 'src/components'));
console.log(`Found ${count} remaining potential contrast issues.`);
