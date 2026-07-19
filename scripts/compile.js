const path = require("node:path");
const qcSolc = require("./qc-solc");

const root = path.resolve(__dirname, "..");

const output = qcSolc.compile([path.join(root, "wrappedq.sol")]);
qcSolc.writeArtifacts(output, path.join(root, "build"));
console.log(`wrappedq.sol compiled OK (${qcSolc.compilerVersion()})`);
