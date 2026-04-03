const fs = require('fs');
const appPath = 'c:/Users/dearm/.antigravity/GeoPolitical-Game/src/App.tsx';
let lines = fs.readFileSync(appPath, 'utf8').split('\n');

// The lines we saw in view_file were 4370-4390.
// Line 4372: </div>
// Line 4373: <div className="w-full bg-slate-100...
// We want to remove 4373-4384 (12 lines).
// Since fs.readFileSync and split might have different line indexing or \r\n,
// let's find the lines by content to be safe.

const startOfRedundant = '                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">';
// We skip leading space for comparison

let foundIndex = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(startOfRedundant)) {
    // Make sure it's the right one (after line 4300)
    if (i > 4300) {
      foundIndex = i;
      break;
    }
  }
}

if (foundIndex !== -1) {
  console.log(`Found redundant block at index ${foundIndex}. Removing 12 lines.`);
  lines.splice(foundIndex, 12);
  fs.writeFileSync(appPath, lines.join('\n'), 'utf8');
  console.log('Successfully removed redundant block.');
} else {
  console.log('Could not find the redundant block by content.');
}
