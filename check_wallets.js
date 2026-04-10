const data = require('/Users/pro/brain-bot/wallets_backup.json');
const ws = data.wallets;
console.log('Wallet count:', ws.length);
for (let i = 0; i < ws.length; i++) {
  const w = ws[i];
  console.log('W'+(i+1)+':', w.address, '| pk:', (w.pk || w.privateKey || '').slice(0,10)+'...');
}
