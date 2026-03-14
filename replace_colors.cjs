const fs = require('fs');
const path = require('path');

const replacements = {
  'bg-slate-950': 'bg-background',
  'bg-slate-900': 'bg-card',
  'bg-slate-800': 'bg-muted',
  'bg-slate-700': 'bg-accent',
  'border-slate-800': 'border-border',
  'border-slate-700': 'border-border',
  'text-slate-50': 'text-foreground',
  'text-slate-200': 'text-foreground',
  'text-slate-300': 'text-muted-foreground',
  'text-slate-400': 'text-muted-foreground',
  'text-slate-500': 'text-muted-foreground',
  'hover:bg-slate-800': 'hover:bg-accent',
  'hover:bg-slate-900': 'hover:bg-card',
  'hover:text-slate-300': 'hover:text-foreground',
  'hover:text-slate-200': 'hover:text-foreground',
};

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir(path.join(__dirname, 'src'), function (filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      content = content.replace(regex, value);
    }

    // Quick fix for hardcoded dark themes on the component level
    content = content.replace(/className="dark"/g, 'className=""');

    if (original !== content) {
      console.log(`Updated ${filePath}`);
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
});
