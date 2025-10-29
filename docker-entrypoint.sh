#!/bin/sh
set -e

RETRIES=${DB_WAIT_RETRIES:-30}
SLEEP_SECS=${DB_WAIT_SLEEP:-2}

attempt=0
until [ $attempt -ge $RETRIES ]
do
  if node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.$queryRawUnsafe('SELECT 1').then(()=>{process.exit(0)}).catch(()=>process.exit(1)).finally(()=>p.$disconnect())"; then
    break
  fi
  attempt=$((attempt+1))
  echo "Waiting for database... ($attempt/$RETRIES)"
  sleep $SLEEP_SECS
done

node -e "
(async ()=>{
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    let count = 0;
    try {
      const rows = await prisma.$queryRawUnsafe('SELECT COUNT(*) AS count FROM \"_prisma_migrations\"');
      const row = Array.isArray(rows) ? rows[0] : rows;
      count = parseInt(row.count || row.COUNT || row[Object.keys(row)[0]] || '0', 10);
    } catch (e) {
      count = 0;
    }
    process.exit(count === 0 ? 10 : 0);
  } catch (e) {
    process.exit(0);
  } finally {
    try { await prisma.$disconnect(); } catch(_){}
  }
})();
" || true
RET=$?
if [ "$RET" -eq 10 ]; then
  echo "Database appears empty. Running prisma migrate dev and seed..."
  npx prisma migrate dev --skip-seed
  npm run seed
else
  echo "Database already initialized. Skipping migrate dev/seed."
fi

exec node dist/src/main.js
