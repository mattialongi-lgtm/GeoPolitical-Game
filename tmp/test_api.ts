
const fetch = require('node-fetch');
async function test() {
    const res = await fetch('http://localhost:3000/api/world-stats', {
        headers: { 'Authorization': 'Bearer ' + process.env.TEST_TOKEN }
    });
    console.log(await res.json());
}
// This needs a token, which I don't have easily.
// I'll check the server logic instead.
