# Upside audit details

- Total Prize Pool: $13,000 in USDC
  - HM awards: up to $9,600 in USDC
    - If no valid Highs or Mediums are found, the HM pool is $0 
  - QA awards: $400 in USDC
  - Judge awards: $2,500 in USDC
  - Scout awards: $500 in USDC
- [Read our guidelines for more details](https://docs.code4rena.com/competitions)
- Starts May 19, 2025 20:00 UTC
- Ends May 26, 2025 20:00 UTC

**Note re: risk level upgrades/downgrades**

Two important notes about judging phase risk adjustments: 
- High- or Medium-risk submissions downgraded to Low-risk (QA) will be ineligible for awards.
- Upgrading a Low-risk finding from a QA report to a Medium- or High-risk finding is not supported.

As such, wardens are encouraged to select the appropriate risk level carefully during the submission phase.

## Automated Findings / Publicly Known Issues

The 4naly3er report can be found [here](https://github.com/code-423n4/2025-05-upside/blob/main/4naly3er-report.md).

_Note for C4 wardens: Anything included in this `Automated Findings / Publicly Known Issues` section is considered a publicly known issue and is ineligible for awards._

### Centralization Risk 

It's possible for the `Owner` to withdraw liquidity for all tokens provided 14 days have passed. This is a global countdown timer that once passed, allows the `Owner` to remove liquidity for migration. This applies for ALL tokens including those that may be deployed in the future.

### Supported Liquidity Tokens

The liquidity token is always intended to be `USDC` and any misbehaviour arising from other tokens as liquidity tokens is out-of-scope.

### Previous Audits

Any vulnerability that was identified in the referenced security audit and was acknowledged should be considered out-of-scope for the purposes of this contest.

# Overview

Upside is a social prediction market (think Polymarket + reddit) where you win money by being early on viral tweets, Spotify songs, YouTube videos, etc.

For a more detailed and in-depth technical overview of the project, please visit the referenced code walk-through below.

## Links

- **Previous audits:**  
  - [Upside.fun (Uptoken) Security Review (May 16, 2025)](https://github.com/code-423n4/2025-05-upside/2025-05-16-hans-upside-v4.pdf)
- **Documentation:** N/A
- [**Code walk-through**](https://www.youtube.com/watch?v=KLh4ysaDhzA)
- **Website:** https://upside.fun/
- **X/Twitter:** https://x.com/UpsideFun

---

# Scope

### Files in scope

| File   | SLOC | Code Coverage (Statements / Branches) | Purpose | Libraries used |
| ------ | --------------- | -- | ---------- | ----- |
| [contracts/UpsideMetaCoin.sol](https://github.com/code-423n4/2025-05-upside/blob/main/contracts/UpsideMetaCoin.sol) | 62 | 100% (80%) | An ERC-20 implementation whose transfers are restricted via a whitelist|@openzeppelin/contracts/token/ERC20/ERC20.sol<br>@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol<br>@openzeppelin/contracts/access/Ownable.sol|
| [contracts/UpsideProtocol.sol](https://github.com/code-423n4/2025-05-upside/blob/main/contracts/UpsideProtocol.sol) | 317 | 100% (98.65%) | Permits the tokenization of any URL through the above token and facilitates swap and fee mechanisms on top of it|@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol<br>@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol<br>@openzeppelin/contracts/access/Ownable.sol<br>contracts/UpsideMetaCoin.sol|
| **Totals** | **379** | 100% (89.325%) | |

*See [scope.txt](https://github.com/code-423n4/2025-05-upside/blob/main/scope.txt) for a machine-readable version*

### Files out of scope

| File         |
| ------------ |
| [contracts/UpsideStaking.sol](https://github.com/code-423n4/2025-05-upside/blob/main/contracts/UpsideStaking.sol) |
| [contracts/UpsideStakingStub.sol](https://github.com/code-423n4/2025-05-upside/blob/main/contracts/UpsideStakingStub.sol) |
| [contracts/mock/USDCMock.sol](https://github.com/code-423n4/2025-05-upside/blob/main/contracts/mock/USDCMock.sol) |
| Totals: 3 |

*See [out_of_scope.txt](https://github.com/code-423n4/2025-05-upside/blob/main/out_of_scope.txt) for a machine-readable version*

# Additional context

## Areas of concern (where to focus for bugs)

Any breach of the following invariants is considered an area of concern for us.

## Main invariants

### Token Restrictions

Tokenization of a URL can only happen once. Tokens are deployed with a fixed initial supply and reserves which cannot be mutated post deployment.

### Whitelist Restrictions

MetaCoin transfers are restricted by whitelist unless explicitly disabled by the `Owner`. The `Owner` can permanently disable the whitelist for any MetaCoin.

### Liquidity Reserves

Reserves for the liquidity token and MetaCoin are always updated after each swap. Sell swaps should never drop below `INITIAL_LIQUIDITY_RESERVES`.

### Fee Flows

Fee revenue is accumulated and must be claimed explicitly by the deployer or `Owner`. Transfers of claimable fees are never automatic.

### Liquidity Withdrawal Restrictions

Liquidity withdrawal is restricted by a global cooldown mechanism. Once triggered, the `Owner` must wait 14 days before a withdrawal can be completed.

## All trusted roles in the protocol

| Role                                | Description                       |
| --------------------------------------- | ---------------------------- |
| Owner                          | - Sets fee parameters<br>- Sets staking contract address<br>- Claims fees<br>- Changes name / symbol of a MetaCoin<br>- Disables whitelist<br>- Withdraws liquidity<br>- Sets tokenization fees<br>- Whitelists addresses for transfers               |

## Running tests

### Setup

Clone the repository locally and change the working directory to it:

```bash
git clone https://github.com/code-423n4/2025-05-upside
cd ./2025-05-upside
```

Make sure you have [foundry](https://github.com/foundry-rs/foundry) (`v1.1.0` tested), [NodeJS](https://nodejs.org/en) (`v20.9.0` tested), as well as [yarn](https://yarnpkg.com/) (`v1.22.22` tested) installed.

Install dependencies:

```bash 
npm i
```

Setup environment:

```bash
npx hardhat vars setup
npx hardhat vars set MNEMONIC
npx hardhat vars set INFURA_API_KEY
npx hardhat vars set BASE_FORK_URL
```

Alternatively, modify the `hardhat` configuration file to utilize a chain configuration for one of the publicly available RPC URLs such as Avalanche or Binance Chain. Here's an example configuration file:

```typescript 
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import type { HardhatUserConfig } from "hardhat/config";
import { vars } from "hardhat/config";
import type { NetworkUserConfig } from "hardhat/types";

import "./tasks/accounts";
import "./deploy/deploy";

// Run 'npx hardhat vars setup' to see the list of variables that need to be set

const mnemonic: string = "test test test test test test test test test test test junk";

const chainIds = {
  "arbitrum-mainnet": 42161,
  avalanche: 43114,
  bsc: 56,
  ganache: 1337,
  hardhat: 31337,
  mainnet: 1,
  "optimism-mainnet": 10,
  "polygon-mainnet": 137,
  "polygon-mumbai": 80001,
  sepolia: 11155111,
  base: 8453,
};

function getChainConfig(chain: keyof typeof chainIds): NetworkUserConfig {
  let jsonRpcUrl: string;
  switch (chain) {
    case "avalanche":
      jsonRpcUrl = "https://api.avax.network/ext/bc/C/rpc";
      break;
    default:
      jsonRpcUrl = "https://bsc-dataseed1.binance.org";
  }
  return {
    accounts: {
      count: 10,
      mnemonic,
      path: "m/44'/60'/0'/0",
    },
    chainId: chainIds[chain],
    url: jsonRpcUrl,
  };
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: {
      arbitrumOne: vars.get("ARBISCAN_API_KEY", ""),
      avalanche: vars.get("SNOWTRACE_API_KEY", ""),
      bsc: vars.get("BSCSCAN_API_KEY", ""),
      mainnet: vars.get("ETHERSCAN_API_KEY", ""),
      optimisticEthereum: vars.get("OPTIMISM_API_KEY", ""),
      polygon: vars.get("POLYGONSCAN_API_KEY", ""),
      polygonMumbai: vars.get("POLYGONSCAN_API_KEY", ""),
      sepolia: vars.get("ETHERSCAN_API_KEY", ""),
      base: vars.get("BASESCAN_API_KEY", ""),
    },
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
    src: "./contracts",
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic,
      },
      chainId: chainIds.hardhat,
    },
    ganache: {
      accounts: {
        mnemonic,
      },
      chainId: chainIds.ganache,
      url: "http://localhost:8545",
    },
    arbitrum: getChainConfig("arbitrum-mainnet"),
    avalanche: getChainConfig("avalanche"),
    bsc: getChainConfig("bsc"),
    mainnet: getChainConfig("mainnet"),
    optimism: getChainConfig("optimism-mainnet"),
    "polygon-mainnet": getChainConfig("polygon-mainnet"),
    "polygon-mumbai": getChainConfig("polygon-mumbai"),
    sepolia: getChainConfig("sepolia"),
    base: getChainConfig("base"),
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.24",
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/hardhat-template/issues/31
        bytecodeHash: "none",
      },
      // Disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 800,
      },
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
};

export default config;
```

So as to be able to run the default test suite of the project, you will need to configure the Coinbase fork URL (`BASE_FORK_URL`) as the test files reference actual deployments of tokens such as `USDC`. 

Please make sure that the RPC end point you're pointing to supports historical queries up to the ones defined in the relevant test suites. You can also update the block number that each test resets the chain to to a recent block that your RPC supports.

### Tests

To run tests: 

```bash 
yarn test
```

### Code Coverage

For code coverage the [`bun` JavaScript runtime](https://bun.sh/) is required (`v1.2.13` tested).

To run code coverage:

```bash
yarn coverage
```

## Submission PoC

As this contest contains a mandatory PoC, we have included a base test file under the `test` sub-folder that contains a boilerplate test which wardens are instructed to fill in with the necessary code to demonstrate their vulnerabilities (if any are found).

The PoC test file in question is [test/PoC.test.ts](https://github.com/code-423n4/2025-05-upside/blob/main/test/PoC.test.ts) and included below for brevity:

```typescript
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
```

## Miscellaneous

Employees of Upside and employees' family members are ineligible to participate in this audit.

Code4rena's rules cannot be overridden by the contents of this README. In case of doubt, please check with C4 staff.
