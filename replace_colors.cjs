const fs = require('fs');
const path = require('path');

const replacements = {
  'bg-[#0a0a0a]': 'bg-[#f4f4f5] dark:bg-[#0a0a0a]',
  'bg-[#141414]': 'bg-white dark:bg-[#141414]',
  'bg-[#141414]/80': 'bg-white/80 dark:bg-[#141414]/80',
  'bg-[#141414]/60': 'bg-white/60 dark:bg-[#141414]/60',
  'bg-[#141414]/90': 'bg-white/90 dark:bg-[#141414]/90',
  'bg-[#1a1a1a]': 'bg-gray-50 dark:bg-[#1a1a1a]',
  'bg-[#1a1a1a]/90': 'bg-white/90 dark:bg-[#1a1a1a]/90',
  'bg-[#1e1e1e]': 'bg-gray-100 dark:bg-[#1e1e1e]',
  'bg-[#222]': 'bg-gray-200 dark:bg-[#222]',
  'text-[#E4E3E0]': 'text-gray-800 dark:text-[#E4E3E0]',
  'text-[#E4E3E0]/50': 'text-gray-500 dark:text-[#E4E3E0]/50',
  'text-[#141414]': 'text-gray-100 dark:text-[#141414]',
  'border-[#E4E3E0]/20': 'border-black/10 dark:border-[#E4E3E0]/20',
  'border-[#E4E3E0]/10': 'border-black/5 dark:border-[#E4E3E0]/10',
  'border-[#E4E3E0]/5': 'border-black/5 dark:border-[#E4E3E0]/5',
  'border-[#E4E3E0]': 'border-gray-800 dark:border-[#E4E3E0]',
  'hover:bg-[#E4E3E0]': 'hover:bg-gray-200 dark:hover:bg-[#E4E3E0]',
  'hover:bg-[#E4E3E0]/20': 'hover:bg-black/10 dark:hover:bg-[#E4E3E0]/20',
  'hover:text-[#141414]': 'hover:text-black dark:hover:text-[#141414]',
  'hover:border-[#E4E3E0]/40': 'hover:border-black/20 dark:hover:border-[#E4E3E0]/40',
};

function processFile(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  let content2 = original;
  for (const [key, value] of Object.entries(replacements)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<!dark:)(?<!dark\\\\s*:\\\\s*)(?<!\\\\[)${escapedKey}`, 'g');
    content2 = content2.replace(regex, value);
  }

  if (content2 !== original) {
    fs.writeFileSync(filePath, content2, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walkUrl(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkUrl(fullPath);
    } else {
      processFile(fullPath);
    }
  });
}

walkUrl('src');
