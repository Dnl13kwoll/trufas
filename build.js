const fs = require('fs');

const url = process.env.SUPABASE_URL      || '';
const key = process.env.SUPABASE_ANON_KEY || '';

if (!url || !key) console.warn('AVISO: SUPABASE_URL ou SUPABASE_ANON_KEY não definidas.');

fs.writeFileSync('config.js',
  `const SUPABASE_URL = '${url}';\nconst SUPABASE_ANON_KEY = '${key}';\n`
);
console.log('config.js gerado.');
