const http = require('http');

http.get('http://localhost:8080/api/properties/public?page=0&size=10', res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        const j = JSON.parse(data);
        console.log(j.content.map(x => ({ id: x.id, title: x.title, ownerId: x.ownerId, customerId: x.customerId })));
    });
});
