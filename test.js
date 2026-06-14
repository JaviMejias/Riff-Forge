const escapedOld = 'C';
const regex1 = new RegExp(`(^|[\\s\\-\\|])${escapedOld}(?=[\\s\\-\\|]|$)`, 'gm');
console.log('regex1:', regex1);
console.log(" C ".replace(regex1, `$1Cadd9`));

const regex2 = new RegExp(`(^|[\\\\s\\\\-\\\\|])${escapedOld}(?=[\\\\s\\\\-\\\\|]|$)`, 'gm');
console.log('regex2:', regex2);
console.log(" C ".replace(regex2, `$1Cadd9`));
