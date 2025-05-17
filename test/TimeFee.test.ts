import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers as hhethers, network } from "hardhat";
import {IERC20Metadata, UpsideMetaCoin, UpsideProtocol, UpsideStakingStub} from "../types";
import {ethers} from "ethers";
import {expect} from "chai";
import {vars} from "hardhat/config";

describe("TimeFee Tests", function () {
  let signers: HardhatEthersSigner[];
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;

  let stakingContract: UpsideStakingStub;
  let upsideProtocol: UpsideProtocol;
  let liquidityToken: IERC20Metadata;
  let linkToken1: UpsideMetaCoin;

  before(async function () {
    signers = await hhethers.getSigners();
    owner = signers[2];
    user1 = signers[0];

    // Reset fork
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: vars.get("BASE_FORK_URL", ""),
            blockNumber: 28668000, // Apr-08-2025 03:15:47 PM +UTC
          },
        },
      ],
    });

    const upsideStakingStubFactory = await hhethers.getContractFactory("UpsideStakingStub");
    stakingContract = await upsideStakingStubFactory.connect(owner).deploy(owner.address);
    await stakingContract.connect(owner).setFeeDestinationAddress(owner.address);

    const upsideProtocolFactory = await hhethers.getContractFactory("UpsideProtocol");
    upsideProtocol = await upsideProtocolFactory.connect(owner).deploy(owner.address);

    liquidityToken = await hhethers.getContractAt("IERC20Metadata", "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
  });

  it("should acquire 250,000 USDC", async function () {
    await obtainTokens(
      "0x3304E22DDaa22bCdC5fCa2269b418046aE7b566A",
      await liquidityToken.getAddress(),
      250000,
      await owner.getAddress()
    );
  });

  it("as Owner, should initialise UpsideProtocol", async function () {
    // Set as Owner
    await upsideProtocol.connect(owner).init(await liquidityToken.getAddress());
  });

  it("as Owner, should set staking contract address", async function () {
    // Should fail as non owner
    await expect(upsideProtocol.connect(user1).setStakingContractAddress(await stakingContract.getAddress())).to.be.reverted;

    // Set as Owner
    await upsideProtocol.connect(owner).setStakingContractAddress(await stakingContract.getAddress());
  });

  it("as Owner, should set swap fees and tokenize fee", async function () {

    const newFeeInfo = {
      tokenizeFeeEnabled: true,
      tokenizeFeeDestinationAddress: await owner.getAddress(),
      swapFeeStartingBp: 9_900,        // 99%
      swapFeeDecayBp: 100,             // 1%
      swapFeeDecayInterval: 6,         // every 6 seconds
      swapFeeFinalBp: 100,             // 1%
      swapFeeDeployerBp: 1_000,         // 10%
      swapFeeSellBp: 100,              // 1%
    };

    await expect(upsideProtocol.connect(user1).setTokenizeFee(await liquidityToken.getAddress(), ethers.parseUnits("5", 6))).to.be.reverted;
    await upsideProtocol.connect(owner).setTokenizeFee(await liquidityToken.getAddress(), ethers.parseUnits("5", 6));

    // Should fail as non owner
    await expect(upsideProtocol.connect(user1).setFeeInfo(newFeeInfo)).to.be.reverted;

    // Set as Owner
    await upsideProtocol.connect(owner).setFeeInfo(newFeeInfo);
  });

  it("should approve 5 USDC and tokenize google.com", async function () {

    // Ensure tokenization fails if no approval
    await expect(upsideProtocol.connect(owner).tokenize("https://google.com", await liquidityToken.getAddress())).to.be.reverted;

    // Approvals
    const _tokenAmount = ethers.parseUnits("5", 6);
    await liquidityToken.connect(owner).approve(await upsideProtocol.getAddress(), _tokenAmount);

    // Tokenization
    const linkTokenAddress = await upsideProtocol.connect(owner).tokenize.staticCall("https://google.com", await liquidityToken.getAddress());
    linkToken1 = await hhethers.getContractAt("UpsideMetaCoin", linkTokenAddress);
    await upsideProtocol.connect(owner).tokenize("https://google.com", await liquidityToken.getAddress());

    // Ensure you cannot tokenize the same url again
    await expect(upsideProtocol.connect(owner).tokenize("https://google.com", await liquidityToken.getAddress())).to.be.revertedWithCustomError(
      upsideProtocol, "MetaCoinExists"
    );
  });

  it("should fail to computeTimeFee for non-existent token", async function () {
    await expect(upsideProtocol.computeTimeFee.staticCall(await liquidityToken.getAddress())).to.be.revertedWithCustomError(
      upsideProtocol, "MetaCoinNonExistent"
    );
  });

  it("should print current swap fee/time fee", async function () {
    const timeFeeInfo = await upsideProtocol.computeTimeFee.staticCall(await linkToken1.getAddress());

    console.log(`\tSeconds passed since deployment: ${timeFeeInfo.secondsPassed}`);
    console.log(`\tCurrent percentage fee: ${timeFeeInfo.swapFeeBp} (note: 10,000 = 100%, 1,000 = 10%)`);
    console.log(`\tCurrent deployer fee: ${timeFeeInfo.deployerFeeBp} (note: 10,000 = 100%, 1,000 = 10%)`);
  });

  it("advance 6 seconds, should print current swap fee/time fee", async function () {
    await network.provider.send("evm_increaseTime", [6]);
    await network.provider.send("evm_mine");

    const timeFeeInfo = await upsideProtocol.computeTimeFee.staticCall(await linkToken1.getAddress());

    console.log(`\tSeconds passed since deployment: ${timeFeeInfo.secondsPassed}`);
    console.log(`\tCurrent percentage fee: ${timeFeeInfo.swapFeeBp} (note: 10,000 = 100%, 1,000 = 10%)`);
    console.log(`\tCurrent deployer fee: ${timeFeeInfo.deployerFeeBp} (note: 10,000 = 100%, 1,000 = 10%)`);
  });

  it("advance 60 seconds, should print current swap fee/time fee", async function () {
    await network.provider.send("evm_increaseTime", [60]);
    await network.provider.send("evm_mine");

    const timeFeeInfo = await upsideProtocol.computeTimeFee.staticCall(await linkToken1.getAddress());

    console.log(`\tSeconds passed since deployment: ${timeFeeInfo.secondsPassed}`);
    console.log(`\tCurrent percentage fee: ${timeFeeInfo.swapFeeBp} (note: 10,000 = 100%, 1,000 = 10%)`);
    console.log(`\tCurrent deployer fee: ${timeFeeInfo.deployerFeeBp} (note: 10,000 = 100%, 1,000 = 10%)`);
  });

  it("advance 6 seconds, should print current swap fee/time fee", async function () {
    await network.provider.send("evm_increaseTime", [3600]);
    await network.provider.send("evm_mine");

    const timeFeeInfo = await upsideProtocol.computeTimeFee.staticCall(await linkToken1.getAddress());

    console.log(`\tSeconds passed since deployment: ${timeFeeInfo.secondsPassed}`);
    console.log(`\tCurrent percentage fee: ${timeFeeInfo.swapFeeBp} (note: 10,000 = 100%, 1,000 = 10%)`);
    console.log(`\tCurrent deployer fee: ${timeFeeInfo.deployerFeeBp} (note: 10,000 = 100%, 1,000 = 10%)`);
  });

  it("should swap 1 USDC for LinkToken", async function () {

    // Approvals
    const _tokenAmount = ethers.parseUnits("1", 6);
    await liquidityToken.connect(owner).approve(await upsideProtocol.getAddress(), _tokenAmount);

    // Static call
    const tokensOut = await upsideProtocol.connect(owner).swap.staticCall(
      await linkToken1.getAddress(),
      true,
      _tokenAmount,
      0,
      await owner.getAddress()
    );
    console.log(`\tSwapped ${ethers.formatUnits(_tokenAmount, 6)} for ${ethers.formatUnits(tokensOut, 18)} LinkTokens`);

    // Real call
    await upsideProtocol.connect(owner).swap(
      await linkToken1.getAddress(),
      true,
      _tokenAmount,
      0,
      await owner.getAddress()
    );
  });
});

export async function obtainTokens(
  fromAddress: string,
  rewardTokenAddress: string,
  tokenAmountRequested: number,
  recipientAddress: string,
) {

  const tokenAmount = ethers.parseUnits(`${tokenAmountRequested}`, 6);

  const tokenContract = <IERC20Metadata>await hhethers.getContractAt("IERC20Metadata", rewardTokenAddress);

  // The address to impersonate and the amount to take
  const _address = fromAddress;

  // Top up the account with a shitload of ETH (so they can transfer ERC20 tokens)
  await hhethers.provider.send("hardhat_setBalance", [_address, "0xC9F2C9CD04674EDEA40000000"]);

  // Impersonate the account
  await hhethers.provider.send("hardhat_impersonateAccount",[_address]);
  const signer = await hhethers.getSigner(_address);

  const oldBalance = await tokenContract.balanceOf(recipientAddress);

  // Connect using the impersonated account
  await tokenContract.connect(signer).transfer(recipientAddress, tokenAmount);

  const newBalance = await tokenContract.balanceOf(recipientAddress);
  expect(newBalance).to.be.eq(oldBalance + tokenAmount);

  console.log(
    "obtained",
    ethers.formatUnits(tokenAmount, await tokenContract.decimals()),
    await tokenContract.symbol(),
    ", current total balance is",
    ethers.formatUnits(
      await tokenContract.balanceOf(recipientAddress),
      await tokenContract.decimals(),
    ),
    await tokenContract.symbol(),
  );
}
