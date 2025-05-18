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

- It's possible for the Owner to withdraw liquidity for all tokens provided 14 days have passed. This is a global countdown timer that once passed, allows the Owner to remove liquidity for migration. This applies for ALL tokens including those that may be deployed in the future.
- The liquidity token is always intended to be USDC.

✅ SCOUTS: Please format the response above 👆 so its not a wall of text and its readable.

# Overview

Upside is a social prediction market (think Polymarket + reddit) where you win money by being early on viral tweets, Spotify songs, YouTube videos, etc..

## Links

- **Previous audits:**  
  - [Upside.fun(Uptoken) Security Review (May 16, 2025)](https://github.com/code-423n4/2025-05-upside/2025-05-16-hans-upside-v4.pdf)
- **Documentation:** n/a
- [**Code walk-through**](https://www.youtube.com/watch?v=KLh4ysaDhzA)
- **Website:** https://upside.fun/
- **X/Twitter:** https://x.com/UpsideFun

---

# Scope

*See [scope.txt](https://github.com/code-423n4/2025-05-upside/blob/main/scope.txt)*

[ ✅ SCOUTS: add scoping and technical details here ]

### Files in scope
- ✅ This should be completed using the `metrics.md` file
- ✅ Last row of the table should be Total: SLOC
- ✅ SCOUTS: Have the sponsor review and and confirm in text the details in the section titled "Scoping Q amp; A"

*For sponsors that don't use the scoping tool: list all files in scope in the table below (along with hyperlinks) -- and feel free to add notes to emphasize areas of focus.*

| File   | Logic Contracts | Interfaces | nSLOC | Purpose | Libraries used |
| ------ | --------------- | ---------- | ----- | -----   | ------------ |
| /contracts/UpsideMetaCoin.sol | 1| 1 | 60 | |@openzeppelin/contracts/token/ERC20/ERC20.sol<br>@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol<br>@openzeppelin/contracts/access/Ownable.sol|
| /contracts/UpsideProtocol.sol | 1| 1 | 294 | |@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol<br>@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol<br>@openzeppelin/contracts/access/Ownable.sol|
| **Totals** | **2** | **2** | **354** | | |


### Files out of scope
✅ SCOUTS: List files/directories out of scope

*See [out_of_scope.txt](https://github.com/code-423n4/2025-05-upside/blob/main/out_of_scope.txt)*

| File         |
| ------------ |
| ./contracts/UpsideStaking.sol |
| ./contracts/UpsideStakingStub.sol |
| Totals: 2 |

# Additional context

## Areas of concern (where to focus for bugs)
None

✅ SCOUTS: Please format the response above 👆 so its not a wall of text and its readable.

## Main invariants

Only the Owner can: set fee parameters, set staking contract address, claim protocol fees, change name/symbol of a MetaCoin, disable whitelist, withdraw liquidity, set tokenization fees and whitelist addresses for transfer.

Tokenization of a URL can only happen once. Tokens are deployed with a fixed initial supply and reserves.

MetaCoin transfers are restricted by whitelist unless explicitly disabled by the Owner. The Owner can permanently disable the whitelist for any MetaCoin.

Reserves for liquidityToken and MetaCoin are always updated after each swap. Sell swaps should never drop below INITIAL_LIQUIDITY_RESERVES.

Fee revenue is accumulated and must be claimed explicitly by the deployer or Owner. Transfers of claimable fees are never automatic.

Liquidity withdrawal is restricted by a global cooldown mechanism. Once triggered, the Owner must wait 14 days before a withdrawal can be completed.

✅ SCOUTS: Please format the response above 👆 so its not a wall of text and its readable.

## All trusted roles in the protocol

Owner

✅ SCOUTS: Please format the response above 👆 using the template below👇

| Role                                | Description                       |
| --------------------------------------- | ---------------------------- |
| Owner                          | Has superpowers                |
| Administrator                             | Can change fees                       |

✅ SCOUTS: Please format the response above 👆 so its not a wall of text and its readable.

## Running tests

Clone the repo

npm i

npx hardhat vars setup

yarn coverage or yarn test

✅ SCOUTS: Please format the response above 👆 using the template below👇

```bash
git clone https://github.com/code-423n4/2023-08-arbitrum
git submodule update --init --recursive
cd governance
foundryup
make install
make build
make sc-election-test
```
To run code coverage
```bash
make coverage
```

✅ SCOUTS: Add a screenshot of your terminal showing the test coverage

## Miscellaneous
Employees of Upside and employees' family members are ineligible to participate in this audit.

Code4rena's rules cannot be overridden by the contents of this README. In case of doubt, please check with C4 staff.
