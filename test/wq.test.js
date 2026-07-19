// Devnet tests for WQ (wrapped native coin, fork of WETH9).
const { test, before } = require("node:test");
const path = require("node:path");
const {
  assert,
  qc,
  getContext,
  compileContract,
  deploy,
  send,
  expectRevert,
  staticCall,
  scalar,
  parseEvents,
  newFundedWallet,
} = require("./helpers");

const overrides = { gasLimit: 200_000n };
const DEPOSIT = 10n ** 15n; // 0.001 Q, keep devnet funds intact

let wallet;
let other;
let wq;
before(async () => {
  ({ wallet } = await getContext());
  other = await newFundedWallet(10n ** 17n);
  const artifact = compileContract(path.resolve(__dirname, "..", "wrappedq.sol"), "WQ");
  wq = await deploy(artifact);
});

test("name, symbol, decimals", async () => {
  assert.equal(scalar(await wq.name()), "Wrapped Q");
  assert.equal(scalar(await wq.symbol()), "WQ");
  assert.equal(BigInt(scalar(await wq.decimals())), 18n);
  assert.equal(scalar(await wq.totalSupply()), 0n);
});

test("deposit credits balance and emits Deposit", async () => {
  const receipt = await send(wq.deposit({ value: DEPOSIT, gasLimit: 200_000n }));
  const [event] = parseEvents(receipt, wq, "Deposit");
  assert.ok(event, "Deposit event missing");
  assert.equal(String(event.args[0]).toLowerCase(), wallet.address.toLowerCase());
  assert.equal(BigInt(event.args[1]), DEPOSIT);
  assert.equal(scalar(await wq.balanceOf(wallet.address)), DEPOSIT);
  assert.equal(scalar(await wq.totalSupply()), DEPOSIT);
});

test("receive() wraps plain transfers", async () => {
  const before = scalar(await wq.balanceOf(wallet.address));
  const tx = await wallet.sendTransaction({ to: wq.target, value: DEPOSIT, gasLimit: 200_000n });
  const receipt = await tx.wait(1, 600_000);
  assert.equal(receipt.status, 1);
  assert.equal(scalar(await wq.balanceOf(wallet.address)), before + DEPOSIT);
});

test("transfer moves balance and emits Transfer", async () => {
  const amount = DEPOSIT / 10n;
  const receipt = await send(wq.transfer(other.address, amount, overrides));
  const [event] = parseEvents(receipt, wq, "Transfer");
  assert.ok(event, "Transfer event missing");
  assert.equal(String(event.args[0]).toLowerCase(), wallet.address.toLowerCase());
  assert.equal(String(event.args[1]).toLowerCase(), other.address.toLowerCase());
  assert.equal(BigInt(event.args[2]), amount);
  assert.equal(scalar(await wq.balanceOf(other.address)), amount);
});

test("transfer beyond balance reverts", async () => {
  const balance = scalar(await wq.balanceOf(wallet.address));
  await expectRevert(staticCall(wq, "transfer", [other.address, balance + 1n]));
});

test("transferFrom respects and decrements allowance", async () => {
  const amount = DEPOSIT / 10n;
  // no allowance yet: other cannot pull from wallet
  await expectRevert(staticCall(wq, "transferFrom", [wallet.address, other.address, amount], { from: other.address }));

  const approveReceipt = await send(wq.approve(other.address, amount, overrides));
  const [approval] = parseEvents(approveReceipt, wq, "Approval");
  assert.ok(approval, "Approval event missing");
  assert.equal(BigInt(approval.args[2]), amount);
  assert.equal(scalar(await wq.allowance(wallet.address, other.address)), amount);

  await send(wq.connect(other).transferFrom(wallet.address, other.address, amount, overrides));
  assert.equal(scalar(await wq.allowance(wallet.address, other.address)), 0n);

  // exceeding the (now zero) allowance reverts
  await expectRevert(staticCall(wq, "transferFrom", [wallet.address, other.address, 1n], { from: other.address }));
});

test("transferFrom with max allowance does not decrement", async () => {
  const amount = DEPOSIT / 10n;
  const max = 2n ** 256n - 1n;
  await send(wq.approve(other.address, max, overrides));
  await send(wq.connect(other).transferFrom(wallet.address, other.address, amount, overrides));
  assert.equal(scalar(await wq.allowance(wallet.address, other.address)), max);
});

test("withdraw pays out native coin and emits Withdrawal", async () => {
  const { provider } = await getContext();
  const amount = DEPOSIT / 10n;
  const wqBalance = scalar(await wq.balanceOf(wallet.address));
  assert.ok(wqBalance >= amount, "insufficient WQ balance for withdraw test");
  const totalSupplyBefore = scalar(await wq.totalSupply());

  const receipt = await send(wq.withdraw(amount, overrides));
  const [event] = parseEvents(receipt, wq, "Withdrawal");
  assert.ok(event, "Withdrawal event missing");
  assert.equal(String(event.args[0]).toLowerCase(), wallet.address.toLowerCase());
  assert.equal(BigInt(event.args[1]), amount);

  assert.equal(scalar(await wq.balanceOf(wallet.address)), wqBalance - amount);
  assert.equal(scalar(await wq.totalSupply()), totalSupplyBefore - amount);
  assert.equal(BigInt(await provider.getBalance(wq.target)), totalSupplyBefore - amount);
});

test("withdraw beyond balance reverts", async () => {
  const balance = scalar(await wq.balanceOf(wallet.address));
  await expectRevert(staticCall(wq, "withdraw", [balance + 1n]));
});
