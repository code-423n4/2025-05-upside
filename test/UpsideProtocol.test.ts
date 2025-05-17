import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers as hhethers, network } from "hardhat";
import {IERC20Metadata, UpsideMetaCoin, UpsideProtocol, UpsideStakingStub} from "../types";
import {ethers} from "ethers";
import {expect} from "chai";
import {vars} from "hardhat/config";

describe("UpsideProtocol Tests", function () {
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
    // Should fail as non owner
    await expect(upsideProtocol.connect(user1).init(await liquidityToken.getAddress())).to.be.reverted;

    // Set as Owner
    await upsideProtocol.connect(owner).init(await liquidityToken.getAddress());

    // Should fail to init again
    await expect(upsideProtocol.connect(owner).init(await liquidityToken.getAddress())).to.be.revertedWith(
      "ALREADY INITIALISED"
    );
  });

  it("as Owner, should set staking contract address", async function () {
    // Should fail as non owner
    await expect(upsideProtocol.connect(user1).setStakingContractAddress(await stakingContract.getAddress())).to.be.reverted;

    // Set as Owner
    await upsideProtocol.connect(owner).setStakingContractAddress(await stakingContract.getAddress());
  });

  it("should successfully tokenize bbc.co.uk (no tokenize fee)", async function () {
    // Tokenization
    const linkTokenAddress = await upsideProtocol.connect(owner).tokenize.staticCall("https://bbc.co.uk", await liquidityToken.getAddress());
    linkToken1 = await hhethers.getContractAt("UpsideMetaCoin", linkTokenAddress);
    await upsideProtocol.connect(owner).tokenize("https://bbc.co.uk", await liquidityToken.getAddress());
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

  it("should fail to tokenize when specifying invalid tokenize fee address", async function () {
    await expect(upsideProtocol.connect(user1).tokenize("http", await user1.getAddress())).to.be.revertedWithCustomError(
      upsideProtocol, "TokenizeFeeInvalid"
    );
  });

  it("as Owner, should fail to setFee if any bp value is > 10,000", async function () {
    await expect(upsideProtocol.connect(owner).setFeeInfo({
      tokenizeFeeEnabled: true,
      tokenizeFeeDestinationAddress: await owner.getAddress(),
      swapFeeStartingBp: 10_001,
      swapFeeDecayBp: 100,
      swapFeeDecayInterval: 6,
      swapFeeFinalBp: 100,
      swapFeeDeployerBp: 1_000,
      swapFeeSellBp: 100,
    })).to.be.revertedWithCustomError(upsideProtocol, "InvalidSetting");

    await expect(upsideProtocol.connect(owner).setFeeInfo({
      tokenizeFeeEnabled: true,
      tokenizeFeeDestinationAddress: await owner.getAddress(),
      swapFeeStartingBp: 1,
      swapFeeDecayBp: 10_001,
      swapFeeDecayInterval: 6,
      swapFeeFinalBp: 100,
      swapFeeDeployerBp: 1_000,
      swapFeeSellBp: 100,
    })).to.be.revertedWithCustomError(upsideProtocol, "InvalidSetting");

    await expect(upsideProtocol.connect(owner).setFeeInfo({
      tokenizeFeeEnabled: true,
      tokenizeFeeDestinationAddress: await owner.getAddress(),
      swapFeeStartingBp: 1,
      swapFeeDecayBp: 1,
      swapFeeDecayInterval: 6,
      swapFeeFinalBp: 10_001,
      swapFeeDeployerBp: 1_000,
      swapFeeSellBp: 100,
    })).to.be.revertedWithCustomError(upsideProtocol, "InvalidSetting");

    await expect(upsideProtocol.connect(owner).setFeeInfo({
      tokenizeFeeEnabled: true,
      tokenizeFeeDestinationAddress: await owner.getAddress(),
      swapFeeStartingBp: 1,
      swapFeeDecayBp: 1,
      swapFeeDecayInterval: 6,
      swapFeeFinalBp: 1,
      swapFeeDeployerBp: 10_001,
      swapFeeSellBp: 100,
    })).to.be.revertedWithCustomError(upsideProtocol, "InvalidSetting");

    await expect(upsideProtocol.connect(owner).setFeeInfo({
      tokenizeFeeEnabled: true,
      tokenizeFeeDestinationAddress: "0x0000000000000000000000000000000000000000",
      swapFeeStartingBp: 1,
      swapFeeDecayBp: 1,
      swapFeeDecayInterval: 6,
      swapFeeFinalBp: 1,
      swapFeeDeployerBp: 10_000,
      swapFeeSellBp: 100,
    })).to.be.revertedWithCustomError(upsideProtocol, "InvalidSetting");

    await expect(upsideProtocol.connect(owner).setFeeInfo({
      tokenizeFeeEnabled: true,
      tokenizeFeeDestinationAddress: await owner.getAddress(),
      swapFeeStartingBp: 1000,
      swapFeeDecayBp: 1,
      swapFeeDecayInterval: 6,
      swapFeeFinalBp: 10_000,
      swapFeeDeployerBp: 10_000,
      swapFeeSellBp: 100,
    })).to.be.revertedWithCustomError(upsideProtocol, "InvalidSetting");

    await expect(upsideProtocol.connect(owner).setFeeInfo({
      tokenizeFeeEnabled: true,
      tokenizeFeeDestinationAddress: await owner.getAddress(),
      swapFeeStartingBp: 10_000,
      swapFeeDecayBp: 1,
      swapFeeDecayInterval: 0,
      swapFeeFinalBp: 1,
      swapFeeDeployerBp: 10_000,
      swapFeeSellBp: 100,
    })).to.be.revertedWithCustomError(upsideProtocol, "InvalidSetting");

    await expect(upsideProtocol.connect(owner).setFeeInfo({
      tokenizeFeeEnabled: true,
      tokenizeFeeDestinationAddress: await owner.getAddress(),
      swapFeeStartingBp: 10_000,
      swapFeeDecayBp: 1,
      swapFeeDecayInterval: 0,
      swapFeeFinalBp: 1,
      swapFeeDeployerBp: 10_000,
      swapFeeSellBp: 10_001,
    })).to.be.revertedWithCustomError(upsideProtocol, "InvalidSetting");
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

  it("should print current swap fee/time fee", async function () {
    const timeFeeInfo = await upsideProtocol.computeTimeFee.staticCall(await linkToken1.getAddress());

    console.log(`\tSeconds passed since deployment: ${timeFeeInfo.secondsPassed}`);
    console.log(`\tCurrent percentage fee: ${timeFeeInfo.swapFeeBp} (note: 10,000 = 100%, 1,000 = 10%)`);
  });

  it("should swap 10 USDC for LinkToken", async function () {

    // Should fail to swap for a non existent MetaCoin
    await expect(upsideProtocol.connect(owner).swap(
      liquidityToken.getAddress(),
      true,
      ethers.parseUnits("5", 6),
      0,
      await owner.getAddress()
    )).to.be.revertedWithCustomError(upsideProtocol, "MetaCoinNonExistent");

    // Approvals
    const _tokenAmount = ethers.parseUnits("10", 6);
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

  it("should print current swap fee/time fee", async function () {
    const timeFeeInfo = await upsideProtocol.computeTimeFee.staticCall(await linkToken1.getAddress());

    console.log(`\tSeconds passed since deployment: ${timeFeeInfo.secondsPassed}`);
    console.log(`\tCurrent percentage fee: ${timeFeeInfo.swapFeeBp} (note: 10,000 = 100%, 1,000 = 10%)`);
  });

  it("should swap 9 LinkToken for USDC", async function () {

    // Approvals
    const _tokenAmount = ethers.parseUnits("9", 18);
    await linkToken1.connect(owner).approve(await upsideProtocol.getAddress(), _tokenAmount);

    // Static call
    const tokensOut = await upsideProtocol.connect(owner).swap.staticCall(
      await linkToken1.getAddress(),
      false,
      _tokenAmount,
      0,
      await owner.getAddress()
    );
    console.log(`\tSwapped ${ethers.formatUnits(_tokenAmount, 18)} for ${ethers.formatUnits(tokensOut, 6)} USDC`);

    // Expect this to fail because the requested minimum out is too high
    await expect(upsideProtocol.connect(owner).swap(
      await linkToken1.getAddress(),
      false,
      _tokenAmount,
      ethers.parseUnits("50", 18),
      await owner.getAddress()
    )).to.be.revertedWithCustomError(upsideProtocol, "InsufficientOutput");

    // Real call
    await upsideProtocol.connect(owner).swap(
      await linkToken1.getAddress(),
      false,
      _tokenAmount,
      0,
      await owner.getAddress()
    );
  });

  it("deployer fee should be equal to 0.09000000000000000", async function () {
    const deployerFee = await upsideProtocol.claimableDeployerFees(await linkToken1.getAddress(), await owner.getAddress());

    // Expectation:
    //  - Deployer fee is only taken on SELL
    //  - We've had one sell of 9 tokens
    //  - Sell Swap fee is 1%   (0.09 tokens)
    //  - Deployer fee is 10%   (0.009 tokens)
    //  = We'd expect to have earned about 0.009

    expect(deployerFee).to.be.eq(ethers.parseUnits("0.009", 18));
  });

  it("should claim deployer fee", async function () {
    const linkAddr = await linkToken1.getAddress();
    const recipient = await owner.getAddress();

    const tx = await upsideProtocol
      .connect(owner)
      .claimDeployerFees(linkAddr, recipient);

    // Ensure the event emitted shows a specific number of fees have been claimed
    const expectedFee = ethers.parseUnits("0.009", 18);
    await expect(tx)
      .to.emit(upsideProtocol, "DeployerFeeClaimed")
      .withArgs(linkAddr, expectedFee, recipient);

    // Second claim — should emit the same event but with 0 fee claimed
    const tx2 = await upsideProtocol.connect(owner).claimDeployerFees(linkAddr, recipient);
    await expect(tx2)
      .to.emit(upsideProtocol, "DeployerFeeClaimed")
      .withArgs(linkAddr, 0, recipient);
  });

  it("protocol fee should be equal to 9.9 USDC", async function () {
    const protocolFee = await upsideProtocol.claimableProtocolFees();

    // Expectation:
    //  - Protocol fee is only taken on BUY
    //  - Swap fee is ~99%
    //  - We've had one buy of 10 USDC
    //  = We'd expect to have earned about 9.9

    expect(protocolFee).to.be.eq(ethers.parseUnits("9.900000", 6));
  });

  it("should claim protocol fee", async function () {
    const recipient = await owner.getAddress();

    // Ensure protocol fees cannot be claimed by non-owner
    await expect(upsideProtocol.connect(user1).claimProtocolFees(recipient)).to.be.reverted;

    // Perform real claim
    const tx = await upsideProtocol
      .connect(owner)
      .claimProtocolFees(recipient);

    // Ensure the event emitted shows a specific number of fees have been claimed
    const expectedFee = ethers.parseUnits("9.9", 6);
    await expect(tx)
      .to.emit(upsideProtocol, "ProtocolFeeClaimed")
      .withArgs(expectedFee, recipient);

    // Ensure claiming a second time results in 0 tokens
    const tx2 = await upsideProtocol
      .connect(owner)
      .claimProtocolFees(recipient);

    // Ensure the event emitted shows a specific number of fees have been claimed
    const expectedFee2 = ethers.parseUnits("0", 6);
    await expect(tx2)
      .to.emit(upsideProtocol, "ProtocolFeeClaimed")
      .withArgs(expectedFee2, recipient);
  });

  it("should start the cooldown timer for withdraw liquidity", async function () {
    // @dev This is a two-step process, call once to start the timer, call again to actually remove the tokens

    // Ensure this fails as non-owner
    await expect(upsideProtocol.connect(user1).withdrawLiquidity([])).to.be.reverted;

    // Should work as Owner
    await upsideProtocol.connect(owner).withdrawLiquidity(
      [await linkToken1.getAddress()]
    );

    // Should fail as Owner, since timer is not completed
    await expect(upsideProtocol.connect(owner).withdrawLiquidity([])).to.be.revertedWithCustomError(
      upsideProtocol, "CooldownTimerNotEnded"
    );
  });

  it("should advance the blockchain by cooldown duration", async function () {
    const cooldownInSeconds = parseInt((await upsideProtocol.WITHDRAW_LIQUIDITY_COOLDOWN()).toString());
    console.log(`\tWithdraw Liquidity Coodown: ${cooldownInSeconds} (advancing blockchain)`);

    await network.provider.send("evm_increaseTime", [cooldownInSeconds]);
    await network.provider.send("evm_mine");
  });

  it("should successfully withdraw liquidity for MetaCoin1", async function () {

    // Retrieve the current values of reserves
    let liquidityTokensInCurve = (await upsideProtocol.metaCoinInfoMap(await linkToken1.getAddress())).liquidityTokenReserves;
    liquidityTokensInCurve -= await upsideProtocol.INITIAL_LIQUIDITY_RESERVES();
    const metaTokensInCurve = (await upsideProtocol.metaCoinInfoMap(await linkToken1.getAddress())).metaCoinReserves;

    const tx = await upsideProtocol.connect(owner).withdrawLiquidity(
      [await linkToken1.getAddress()]
    );

    await expect(tx)
      .to.emit(upsideProtocol, "LiquidityWithdrawn")
      .withArgs(await linkToken1.getAddress(), liquidityTokensInCurve, metaTokensInCurve);
  });

  it("should successfully set new name and symbol for MetaCoin 1", async function () {

    const _newName = "CoinOne";
    const _newSymbol = "Coin1";

    // Not Owner
    await expect(upsideProtocol.connect(user1).setMetaCoinNameSymbol(await linkToken1.getAddress(), _newName, _newSymbol)).to.be.reverted;

    // Non-existent
    await expect(upsideProtocol.connect(owner).setMetaCoinNameSymbol(await user1.getAddress(), _newName, _newSymbol)).to.be.reverted;

    await upsideProtocol.connect(owner).setMetaCoinNameSymbol(await linkToken1.getAddress(), _newName, _newSymbol);

    expect(await linkToken1.name()).to.be.eq(_newName);
    expect(await linkToken1.symbol()).to.be.eq(_newSymbol);
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
