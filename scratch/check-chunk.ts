import http from 'http';

http.get('http://localhost:3000/_next/static/chunks/app/layout.js', (res) => {
  console.log('STATUS:', res.statusCode);
  console.log('HEADERS:', res.headers);
  res.on('data', (chunk) => {
    console.log('BODY SAMPLE:', chunk.toString().substring(0, 100));
  });
}).on('error', (e) => {
  console.error('ERROR:', e.message);
});
