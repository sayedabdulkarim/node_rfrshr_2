console.log("1 - Start");

setImmediate(() => {
  console.log("2 - setImmediate");
});

process.nextTick(() => {
  console.log("3 - nextTick");
});

console.log("4 - End");
