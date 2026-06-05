const fs = require('fs');

let content = fs.readFileSync('src/data/layers.js', 'utf8');

content = content.replace(/€([\d\s\u202F]+)/g, (match, numStr) => {
  const num = parseInt(numStr.replace(/[\s\u202F]/g, ''), 10);
  if (isNaN(num)) return match;
  return num.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '€';
});

fs.writeFileSync('src/data/layers.js', content, 'utf8');
console.log('layers.js updated');
