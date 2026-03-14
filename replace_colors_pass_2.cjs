const fs = require('fs');
const path = require('path');

const replacements = {
    // Overlays and Modals
    'bg-black/50': 'bg-background/80 backdrop-blur-sm',
    'bg-black/80': 'bg-background/80 backdrop-blur-sm',
    'bg-black': 'bg-background',

    // Specific Generic Colors that clash with Light Mode
    'text-white': 'text-foreground',
    'text-white/80': 'text-muted-foreground',
    'text-white/60': 'text-muted-foreground',
    'text-gray-400': 'text-muted-foreground',
    'text-gray-500': 'text-muted-foreground',
    'text-gray-300': 'text-muted-foreground',
    'text-slate-50': 'text-foreground',
    'text-slate-100': 'text-foreground',

    'bg-gray-800': 'bg-muted',
    'bg-gray-900': 'bg-card',
    'bg-slate-900/50': 'bg-card/50',
    'bg-slate-800/50': 'bg-muted/50',

    'bg-[#0A0A0A]': 'bg-background',
    'border-[#222222]': 'border-border',
    'border-white/10': 'border-border',
    'border-white/20': 'border-border',
    'bg-white/5': 'bg-muted/50',
    'bg-white/10': 'bg-muted/50',

    'hover:bg-white/10': 'hover:bg-accent',
    'hover:bg-white/5': 'hover:bg-accent/50',
    'hover:text-white': 'hover:text-foreground',
    'hover:text-slate-50': 'hover:text-foreground',

    'ring-offset-slate-950': 'ring-offset-background',
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

        // Sort keys by length descending to replace longer strings first (e.g. text-white/80 before text-white)
        const sortedKeys = Object.keys(replacements).sort((a, b) => b.length - a.length);

        for (const key of sortedKeys) {
            const value = replacements[key];
            // Escape special characters in key for regex
            const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            // Use negative lookahead to avoid replacing parts of other classes
            const regex = new RegExp(`(?<![a-zA-Z0-9-])${escapedKey}(?![a-zA-Z0-9-])`, 'g');
            content = content.replace(regex, value);
        }

        if (original !== content) {
            console.log(`Updated ${filePath}`);
            fs.writeFileSync(filePath, content, 'utf8');
        }
    }
});
