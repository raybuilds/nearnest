const fs = require('fs');
const content = fs.readFileSync('./seed.js', 'utf8');
const newHash = '$2b$10$KlL4z1y66WzubpzdEIjgrOYoZxas4kZyZLy/sLyVxdHl2Cmx2Rncq';
const fixed = content.replace(/password: '\$2a\$[A-Za-z0-9\.]+'/g, `password: '${newHash}'`);
fs.writeFileSync('./seed.js', fixed);
console.log('Passwords fixed!');
