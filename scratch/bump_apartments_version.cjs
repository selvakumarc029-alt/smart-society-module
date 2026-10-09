const fs = require('fs');
const path = require('path');

const p1 = path.resolve('src/main/resources/templates/propertydirect/apartments.html');
let c1 = fs.readFileSync(p1, 'utf8');
c1 = c1.replace(
    '/propertydirect/js/apartments-features.js?v=20261009-v1',
    '/propertydirect/js/apartments-features.js?v=20261009-fix-perf-v2'
);
fs.writeFileSync(p1, c1, 'utf8');
console.log('✓ Bumped version in src apartments.html');

const p2 = path.resolve('target/classes/templates/propertydirect/apartments.html');
if (fs.existsSync(p2)) {
    let c2 = fs.readFileSync(p2, 'utf8');
    c2 = c2.replace(
        '/propertydirect/js/apartments-features.js?v=20261009-v1',
        '/propertydirect/js/apartments-features.js?v=20261009-fix-perf-v2'
    );
    fs.writeFileSync(p2, c2, 'utf8');
    console.log('✓ Bumped version in target apartments.html');
}
