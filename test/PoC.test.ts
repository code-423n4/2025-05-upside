import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers as hhethers } from "hardhat";
import {IERC20Metadata, UpsideMetaCoin, UpsideProtocol, UpsideStakingStub} from "../types";

describe("C4 PoC Test Suite", function () {
  let signers: HardhatEthersSigner[];
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;

  let stakingContract: UpsideStakingStub;
  let upsideProtocol: UpsideProtocol;
  let liquidityToken: IERC20Metadata;
  let sampleLinkToken: UpsideMetaCoin;

  before(async function () {
    signers = await hhethers.getSigners();
    owner = signers[2];
    user1 = signers[0];

    const upsideStakingStubFactory = await hhethers.getContractFactory("UpsideStakingStub");
    stakingContract = await upsideStakingStubFactory.connect(owner).deploy(owner.address);
    await stakingContract.connect(owner).setFeeDestinationAddress(owner.address);

    const upsideProtocolFactory = await hhethers.getContractFactory("UpsideProtocol");
    upsideProtocol = await upsideProtocolFactory.connect(owner).deploy(owner.address);

    // Deploy mock USDC
    const liquidityTokenFactory = await hhethers.getContractFactory("USDCMock");
    liquidityToken = await liquidityTokenFactory.connect(owner).deploy();

    // Setup protocol
    await upsideProtocol.connect(owner).init(await liquidityToken.getAddress());
    await upsideProtocol.connect(owner).setStakingContractAddress(await stakingContract.getAddress());
    
    // Deploy a simple Tokenized URL
    await upsideProtocol.connect(owner).tokenize("https://code4rena.com/", await liquidityToken.getAddress());
    sampleLinkToken = await hhethers.getContractAt("UpsideMetaCoin", await upsideProtocol.urlToMetaCoinMap("https://code4rena.com/"));
  });

  it("should demonstrate the flaw of the C4 submission", async function () {
    // Insert code here, tokens can be minted via liquidityToken.mint
  });
});
