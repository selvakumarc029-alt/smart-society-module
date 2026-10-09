const fs = require('fs');
const html = fs.readFileSync('src/main/resources/templates/propertydirect/dashboards/customer.html', 'utf8');

const sectionsOpen = (html.match(/<section\b[^>]*>/gi) || []).length;
const sectionsClose = (html.match(/<\/section>/gi) || []).length;
console.log('Sections: open =', sectionsOpen, 'close =', sectionsClose);

const formsOpen = (html.match(/<form\b[^>]*>/gi) || []).length;
const formsClose = (html.match(/<\/form>/gi) || []).length;
console.log('Forms: open =', formsOpen, 'close =', formsClose);

const divsOpen = (html.match(/<div\b[^>]*>/gi) || []).length;
const divsClose = (html.match(/<\/div>/gi) || []).length;
console.log('Divs: open =', divsOpen, 'close =', divsClose);

const spansOpen = (html.match(/<span\b[^>]*>/gi) || []).length;
const spansClose = (html.match(/<\/span>/gi) || []).length;
console.log('Spans: open =', spansOpen, 'close =', spansClose);
