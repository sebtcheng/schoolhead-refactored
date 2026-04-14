
const pInt = (v) => (v === '' || v === null || v === undefined || isNaN(parseInt(v))) ? 0 : parseInt(v);

console.log('empty string:', pInt(''));
console.log('null:', pInt(null));
console.log('undefined:', pInt(undefined));
console.log('NaN string:', pInt('NaN'));
console.log('0 string:', pInt('0'));
console.log('0 number:', pInt(0));
console.log('1 string:', pInt('1'));
console.log('space string:', pInt(' '));
