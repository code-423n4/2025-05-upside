import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers as hhethers, network } from "hardhat";
import {IERC20Metadata, UpsideMetaCoin, UpsideProtocol, UpsideStaking} from "../types";
import {ethers} from "ethers";
import {expect} from "chai";
import {vars} from "hardhat/config";

describe("Staking integration test", function () {
  let signers: HardhatEthersSigner[];
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;

  let stakingContract: UpsideStaking;
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

    // Deploy the UpsideProtocol
    const upsideProtocolFactory = await hhethers.getContractFactory("UpsideProtocol");
    upsideProtocol = await upsideProtocolFactory.connect(owner).deploy(owner.address);

    const upsideStakingContract = await hhethers.getContractFactory("UpsideStaking");
    stakingContract = await upsideStakingContract.connect(owner).deploy(await upsideProtocol.getAddress(), owner.address);

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

  it("should advance the blockchain by 24 hours", async function () {
    const cooldownInSeconds = 86400;
    await network.provider.send("evm_increaseTime", [cooldownInSeconds]);
    await network.provider.send("evm_mine");
  });

  it("should swap 1,000 USDC for LinkToken", async function () {

    // Approvals
    const _tokenAmount = ethers.parseUnits("1000", 6);
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

  it("should swap 5 LinkToken for USDC", async function () {

    // Approvals
    const _tokenAmount = ethers.parseUnits("5", 18);
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

    await upsideProtocol.connect(owner).swap(
      await linkToken1.getAddress(),
      false,
      _tokenAmount,
      0,
      await owner.getAddress()
    );
  });

  it("protocol fee on staking contract for MetaCoin should be equal to 0.045", async function () {
    const protocolFee = await stakingContract.protocolFees(await linkToken1.getAddress());
    expect(protocolFee).to.be.eq(ethers.parseUnits("0.045", 18));
  });

  it("protocol fee recipient should claim from staking contract", async function () {
    // Attempt to claim protocol fees as non protocol-fee-recipient
    await expect(stakingContract.connect(user1).claimProtocolFees(
      [await linkToken1.getAddress()]
    )).to.be.revertedWithCustomError(stakingContract, "Unauthorised");

    // Claim as recipient
    await stakingContract.connect(owner).claimProtocolFees(
      [await linkToken1.getAddress()]
    );
  });

  it("should change protocol fee recipient", async function () {
    // Fail as unauthorised user
    await expect(stakingContract.connect(user1).setProtocolFeeRecipient(
      await user1.getAddress()
    )).to.be.revertedWithCustomError(stakingContract, "Unauthorised");

    // Claim as recipient
    await stakingContract.connect(owner).setProtocolFeeRecipient(
      await user1.getAddress()
    );
  });

  it("should fail to distribute reward tokens to non whitelisted MetaCoin", async function () {
    // Fail as unauthorised user
    await expect(stakingContract.connect(owner).distributeRewards(
      await user1.getAddress(), ethers.parseUnits("1", 18)
    )).to.be.revertedWithCustomError(stakingContract, "TokenNotWhitelisted");
  });

  it("should fail to whitelist staking token as non owner", async function () {
    // Fail as unauthorised user
    await expect(stakingContract.connect(owner).whitelistStakingToken(
      await user1.getAddress()
    )).to.be.revertedWithCustomError(stakingContract, "OwnableUnauthorizedAccount");
  });

  it("should stake 1 MetaCoin", async function () {
    // Should fail to stake a non-whitelisted token
    await expect(stakingContract.connect(owner).stake(
        await owner.getAddress(), ethers.parseUnits("1", 18)
    )).to.be.revertedWithCustomError(stakingContract, "TokenNotWhitelisted");

    // Approve then Perform real stake
    const _amountToStake = ethers.parseUnits("1", 18);
    await linkToken1.connect(owner).approve(await stakingContract.getAddress(), _amountToStake);
    await stakingContract.connect(owner).stake(
      await linkToken1.getAddress(), _amountToStake
    );
  });

  it("expect rewards earned to be equal to 0", async function () {
    expect(await stakingContract.calculateRewardsEarned(await linkToken1.getAddress(), await owner.getAddress())).to.be.eq(0);
  });

  it("should swap 1 LinkToken for USDC", async function () {
    // Approvals
    const _tokenAmount = ethers.parseUnits("1", 18);
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

    await upsideProtocol.connect(owner).swap(
      await linkToken1.getAddress(),
      false,
      _tokenAmount,
      0,
      await owner.getAddress()
    );
  });

  it("expect rewards earned to be equal to 0.009", async function () {
    expect(await stakingContract.calculateRewardsEarned(await linkToken1.getAddress(), await owner.getAddress())).to.be.eq(
      ethers.parseUnits("0.009", 18)
    );
  });

  it("should claim 0.009 MetaCoins", async function () {
    const tx = await stakingContract.connect(owner).claim(
      [await linkToken1.getAddress()]
    );
    await expect(tx)
      .to.emit(stakingContract, "Claimed")
      .withArgs(await linkToken1.getAddress(), ethers.parseUnits("0.009", 18));
  });

  it("should unstake 0.5 MetaCoins", async function () {
    // Should fail to unstake invalid token
    await expect(stakingContract.connect(owner).unstake(await owner.getAddress(), ethers.parseUnits("0.5", 18))).to.be.revertedWithCustomError(
      stakingContract, "TokenNotWhitelisted"
    );

    // Perform real unstake
    await stakingContract.connect(owner).unstake(await linkToken1.getAddress(), ethers.parseUnits("0.5", 18));
  });

  // TODO: Next bunch of tests should be ensuring we are allocating correctly for multiple users
  // TODO: Potentially remove as much as possible from staking contract that is not needed
  // TODO: eg when unstaking, there is probably no need to check if the token is whitelisted
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
