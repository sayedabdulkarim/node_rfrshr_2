console.log("1 - Start");

process.nextTick(() => {
  console.log("3 - nextTick");
});

setImmediate(() => {
  console.log("2 - setImmediate");
});

setTimeout(() => {
  console.log("5 - Timer executed");
}, 0);
console.log("4 - End");
