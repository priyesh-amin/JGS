import fixtures from './src/data/fixtures.json' with { type: "json" };

const featuredEvent = fixtures.find(f => f.isCharityDay) || fixtures[0];

console.log('--- DEBUG INFO ---');
console.log('Number of fixtures:', fixtures.length);
console.log('Found Featured Event:', featuredEvent);
console.log('Season Opener isCharityDay:', fixtures[0].isCharityDay, typeof fixtures[0].isCharityDay);
console.log('Charity Day isCharityDay:', fixtures[4].isCharityDay, typeof fixtures[4].isCharityDay);
