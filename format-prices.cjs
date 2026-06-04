const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) { 
      results.push(file);
    }
  });
  return results;
}
const files = walk('./src');
let changedCount = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes("toLocaleString('bg-BG')")) {
    content = content.replace(/\.toLocaleString\('bg-BG'\)/g, ".toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})");
    content = content.replace(/\} €/g, '}€');
    fs.writeFileSync(file, content, 'utf8');
    changedCount++;
    console.log('Updated ' + file);
  }
});
console.log('Changed files: ' + changedCount);
