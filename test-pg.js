require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect()
  .then(() => {
    console.log('CONNECTED OK');
    return client.end();
  })
  .catch((err) => {
    console.error('CONNECT FAILED - full error:');
    console.error(err);
    console.error('code:', err.code);
  });