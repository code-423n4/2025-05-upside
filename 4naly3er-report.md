# Report


## Gas Optimizations


| |Issue|Instances|
|-|:-|:-:|
| [GAS-1](#GAS-1) | Don't use `_msgSender()` if not supporting EIP-2771 | 3 |
| [GAS-2](#GAS-2) | `a = a + b` is more gas effective than `a += b` for state variables (excluding arrays and mappings) | 3 |
| [GAS-3](#GAS-3) | Using bools for storage incurs overhead | 1 |
| [GAS-4](#GAS-4) | Cache array length outside of loop | 2 |
| [GAS-5](#GAS-5) | For Operations that will not overflow, you could use unchecked | 44 |
| [GAS-6](#GAS-6) | Use Custom Errors instead of Revert Strings to save Gas | 2 |
| [GAS-7](#GAS-7) | Functions guaranteed to revert when called by normal users can be marked `payable` | 8 |
| [GAS-8](#GAS-8) | Using `private` rather than `public` for constants, saves gas | 2 |
### <a name="GAS-1"></a>[GAS-1] Don't use `_msgSender()` if not supporting EIP-2771
Use `msg.sender` if the code does not implement [EIP-2771 trusted forwarder](https://eips.ethereum.org/EIPS/eip-2771) support

*Instances (3)*:
```solidity
File: contracts/UpsideMetaCoin.sol

74:         _transfer(_msgSender(), to, amount);

81:         uint256 currentAllowance = allowance(from, _msgSender());

83:         _approve(from, _msgSender(), currentAllowance - amount);

```

### <a name="GAS-2"></a>[GAS-2] `a = a + b` is more gas effective than `a += b` for state variables (excluding arrays and mappings)
This saves **16 gas per instance.**

*Instances (3)*:
```solidity
File: contracts/UpsideProtocol.sol

216:             claimableProtocolFees += fee;

224:             claimableDeployerFees[_metaCoinAddress][_deployer] += feeToDeployer;

385:             tokensToWithdraw += liquidityTokensInCurve;

```

### <a name="GAS-3"></a>[GAS-3] Using bools for storage incurs overhead
Use uint256(1) and uint256(2) for true/false to avoid a Gwarmaccess (100 gas), and to avoid Gsset (20000 gas) when changing from ‘false’ to ‘true’, after having been ‘true’ in the past. See [source](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/58f635312aa21f947cae5f8578638a85aa2519f5/contracts/security/ReentrancyGuard.sol#L23-L27).

*Instances (1)*:
```solidity
File: contracts/UpsideProtocol.sol

51:     mapping(address metaCoinAddress => mapping(address walletAddress => bool isWhitelisted))

```

### <a name="GAS-4"></a>[GAS-4] Cache array length outside of loop
If not cached, the solidity compiler will always read the length of the array during each iteration. That is, if it is a storage array, this is an extra sload operation (100 additional extra gas for each iteration except for the first) and if it is a memory array, this is an extra mload operation (3 additional gas for each iteration except for the first).

*Instances (2)*:
```solidity
File: contracts/UpsideProtocol.sol

326:         for (uint256 i; i < _metaCoinAddresses.length; ) {

375:         for (uint256 i; i < _metaCoinAddresses.length; ) {

```

### <a name="GAS-5"></a>[GAS-5] For Operations that will not overflow, you could use unchecked

*Instances (44)*:
```solidity
File: contracts/UpsideMetaCoin.sol

10: import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

11: import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

12: import "@openzeppelin/contracts/access/Ownable.sol";

83:         _approve(from, _msgSender(), currentAllowance - amount);

107: The Licensor hereby grants you the right to copy, modify, create derivative works, redistribute, and make non-production use of the Licensed Work. The Licensor may make an Additional Use Grant, above, permitting limited production use.

121: TO THE EXTENT PERMITTED BY APPLICABLE LAW, THE LICENSED WORK IS PROVIDED ON AN “AS IS” BASIS. LICENSOR HEREBY DISCLAIMS ALL WARRANTIES AND CONDITIONS, EXPRESS OR IMPLIED, INCLUDING (WITHOUT LIMITATION) WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND TITLE.

```

```solidity
File: contracts/UpsideProtocol.sol

10: import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

11: import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

12: import "@openzeppelin/contracts/access/Ownable.sol";

13: import "./UpsideMetaCoin.sol";

40:     uint256 private constant META_COIN_DEFAULT_TOTAL_SUPPLY = 1_000_000 * (10 ** 18);

41:     uint256 public constant INITIAL_LIQUIDITY_RESERVES = 10_000 * (10 ** 6);

47:     uint256 public claimableProtocolFees; // @dev This is always in liquidity tokens

77:         uint256 totalFee, // Total fee for the swap

78:         uint256 feeToProtocol, // Only used for buy swaps

79:         uint256 feeToDeployer, // Only used for sell swaps

80:         uint256 feeToStakers // Only used for sell swaps

179:         secondsPassed = block.timestamp - metaCoinInfo.createdAtUnix;

180:         uint256 intervalsElapsed = secondsPassed / fee.swapFeeDecayInterval;

181:         uint256 feeReduction = intervalsElapsed * fee.swapFeeDecayBp;

183:         if (feeReduction >= (fee.swapFeeStartingBp - fee.swapFeeFinalBp)) {

186:             swapFeeBp = fee.swapFeeStartingBp - feeReduction;

213:             fee = (_tokenAmount * swapFeeBp) / 10000;

214:             tokenAmountAfterFee = _tokenAmount - fee;

216:             claimableProtocolFees += fee;

220:             fee = (_tokenAmount * feeInfo.swapFeeSellBp) / 10000;

221:             tokenAmountAfterFee = _tokenAmount - fee;

223:             feeToDeployer = (fee * swapDeployerFeeBp) / 10000;

224:             claimableDeployerFees[_metaCoinAddress][_deployer] += feeToDeployer;

225:             feeToStakers = fee - feeToDeployer;

274:             newLiquidityTokenReserves = metaCoinInfo.liquidityTokenReserves + amountInAfterFee;

275:             amountOut = (metaCoinInfo.metaCoinReserves * amountInAfterFee) / newLiquidityTokenReserves;

276:             newMetaCoinReserves = metaCoinInfo.metaCoinReserves - amountOut;

278:             newMetaCoinReserves = metaCoinInfo.metaCoinReserves + amountInAfterFee;

279:             amountOut = (metaCoinInfo.liquidityTokenReserves * amountInAfterFee) / newMetaCoinReserves;

280:             newLiquidityTokenReserves = metaCoinInfo.liquidityTokenReserves - amountOut;

330:                 ++i;

364:             emit WithdrawLiquidityTimerStarted(block.timestamp + WITHDRAW_LIQUIDITY_COOLDOWN);

369:         uint256 withdrawalAllowedBlockTimestamp = withdrawLiquidityTimerStartTime + WITHDRAW_LIQUIDITY_COOLDOWN;

377:             uint256 liquidityTokensInCurve = metaCoinInfo.liquidityTokenReserves - INITIAL_LIQUIDITY_RESERVES;

385:             tokensToWithdraw += liquidityTokensInCurve;

392:                 ++i;

471: The Licensor hereby grants you the right to copy, modify, create derivative works, redistribute, and make non-production use of the Licensed Work. The Licensor may make an Additional Use Grant, above, permitting limited production use.

485: TO THE EXTENT PERMITTED BY APPLICABLE LAW, THE LICENSED WORK IS PROVIDED ON AN “AS IS” BASIS. LICENSOR HEREBY DISCLAIMS ALL WARRANTIES AND CONDITIONS, EXPRESS OR IMPLIED, INCLUDING (WITHOUT LIMITATION) WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND TITLE.

```

### <a name="GAS-6"></a>[GAS-6] Use Custom Errors instead of Revert Strings to save Gas
Custom errors are available from solidity version 0.8.4. Custom errors save [**~50 gas**](https://gist.github.com/IllIllI000/ad1bd0d29a0101b25e57c293b4b0c746) each time they're hit by [avoiding having to allocate and store the revert string](https://blog.soliditylang.org/2021/04/21/custom-errors/#errors-in-depth). Not defining the strings also save deployment gas

Additionally, custom errors can be used inside and outside of contracts (including interfaces and libraries).

Source: <https://blog.soliditylang.org/2021/04/21/custom-errors/>:

> Starting from [Solidity v0.8.4](https://github.com/ethereum/solidity/releases/tag/v0.8.4), there is a convenient and gas-efficient way to explain to users why an operation failed through the use of custom errors. Until now, you could already use strings to give more information about failures (e.g., `revert("Insufficient funds.");`), but they are rather expensive, especially when it comes to deploy cost, and it is difficult to use dynamic information in them.

Consider replacing **all revert strings** with custom errors in the solution, and particularly those that have multiple occurrences:

*Instances (2)*:
```solidity
File: contracts/UpsideMetaCoin.sol

82:         require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");

```

```solidity
File: contracts/UpsideProtocol.sol

313:         require(liquidityTokenAddress == address(0), "ALREADY INITIALISED");

```

### <a name="GAS-7"></a>[GAS-7] Functions guaranteed to revert when called by normal users can be marked `payable`
If a function modifier such as `onlyOwner` is used, the function will revert if a normal user tries to pay the function. Marking the function as `payable` will lower the gas cost for legitimate callers because the compiler will not include checks for whether a payment was provided.

*Instances (8)*:
```solidity
File: contracts/UpsideMetaCoin.sol

56:     function setNameAndSymbol(string memory _name, string memory _symbol) external onlyOwner {

```

```solidity
File: contracts/UpsideProtocol.sol

312:     function init(address _liquidityTokenAddress) external onlyOwner {

337:     function setFeeInfo(FeeInfo calldata _newFeeInfo) external onlyOwner {

357:     function withdrawLiquidity(address[] calldata _metaCoinAddresses) external onlyOwner {

402:     function disableWhitelist(address _metaCoinAddress) external onlyOwner {

417:     function claimProtocolFees(address _recipient) external onlyOwner {

427:     function setStakingContractAddress(address _newStakingContractAddress) external onlyOwner {

435:     function setTokenizeFee(address _tokenizeFeeAddress, uint256 _tokenizeFeeAmount) external onlyOwner {

```

### <a name="GAS-8"></a>[GAS-8] Using `private` rather than `public` for constants, saves gas
If needed, the values can be read from the verified contract source code, or if there are multiple values there can be a single getter function that [returns a tuple](https://github.com/code-423n4/2022-08-frax/blob/90f55a9ce4e25bceed3a74290b854341d8de6afa/src/contracts/FraxlendPair.sol#L156-L178) of the values of all currently-public constants. Saves **3406-3606 gas** in deployment gas due to the compiler not having to create non-payable getter functions for deployment calldata, not having to store the bytes of the value outside of where it's used, and not adding another entry to the method ID table

*Instances (2)*:
```solidity
File: contracts/UpsideProtocol.sol

41:     uint256 public constant INITIAL_LIQUIDITY_RESERVES = 10_000 * (10 ** 6);

42:     uint256 public constant WITHDRAW_LIQUIDITY_COOLDOWN = 14 days;

```


## Non Critical Issues


| |Issue|Instances|
|-|:-|:-:|
| [NC-1](#NC-1) | `constant`s should be defined rather than using magic numbers | 14 |
| [NC-2](#NC-2) | Control structures do not follow the Solidity Style Guide | 24 |
| [NC-3](#NC-3) | Consider disabling `renounceOwnership()` | 2 |
| [NC-4](#NC-4) | Functions should not be longer than 50 lines | 19 |
| [NC-5](#NC-5) | Lines are too long | 26 |
| [NC-6](#NC-6) | Take advantage of Custom Error's return value property | 12 |
| [NC-7](#NC-7) | Use scientific notation (e.g. `1e18`) rather than exponentiation (e.g. `10**18`) | 2 |
| [NC-8](#NC-8) | Avoid the use of sensitive terms | 15 |
| [NC-9](#NC-9) | Use Underscores for Number Literals (add an underscore every 3 digits) | 10 |
### <a name="NC-1"></a>[NC-1] `constant`s should be defined rather than using magic numbers
Even [assembly](https://github.com/code-423n4/2022-05-opensea-seaport/blob/9d7ce4d08bf3c3010304a0476a785c70c0e90ae7/contracts/lib/TokenTransferrer.sol#L35-L39) can benefit from using readable constants instead of hex/numeric literals

*Instances (14)*:
```solidity
File: contracts/UpsideMetaCoin.sol

5: Change Date:        4 years after initial deployment of this contract.

105: License text copyright (c) 2017 MariaDB Corporation Ab, All Rights Reserved. “Business Source License” is a trademark of MariaDB Corporation Ab.

129: To specify as the Change License the GPL Version 2.0 or any later version, or a license that is compatible with GPL Version 2.0 or a later version, where “compatible” means that software provided under the Change License can be included in a program with software provided under GPL Version 2.0 or a later version. Licensor may specify additional Change Licenses without limitation.

```

```solidity
File: contracts/UpsideProtocol.sol

5: Change Date:        4 years after initial deployment of this contract.

213:             fee = (_tokenAmount * swapFeeBp) / 10000;

220:             fee = (_tokenAmount * feeInfo.swapFeeSellBp) / 10000;

223:             feeToDeployer = (fee * swapDeployerFeeBp) / 10000;

339:             _newFeeInfo.swapFeeDeployerBp > 10000 ||

340:             _newFeeInfo.swapFeeDecayBp > 10000 ||

341:             _newFeeInfo.swapFeeFinalBp > 10000 ||

342:             _newFeeInfo.swapFeeStartingBp > 10000 ||

343:             _newFeeInfo.swapFeeSellBp > 10000 ||

469: License text copyright (c) 2017 MariaDB Corporation Ab, All Rights Reserved. “Business Source License” is a trademark of MariaDB Corporation Ab.

493: To specify as the Change License the GPL Version 2.0 or any later version, or a license that is compatible with GPL Version 2.0 or a later version, where “compatible” means that software provided under the Change License can be included in a program with software provided under GPL Version 2.0 or a later version. Licensor may specify additional Change Licenses without limitation.

```

### <a name="NC-2"></a>[NC-2] Control structures do not follow the Solidity Style Guide
See the [control structures](https://docs.soliditylang.org/en/latest/style-guide.html#control-structures) section of the Solidity Style Guide

*Instances (24)*:
```solidity
File: contracts/UpsideMetaCoin.sol

65:         if (

107: The Licensor hereby grants you the right to copy, modify, create derivative works, redistribute, and make non-production use of the Licensed Work. The Licensor may make an Additional Use Grant, above, permitting limited production use.

109: Effective on the Change Date, or the fourth anniversary of the first publicly available distribution of a specific version of the Licensed Work under this License, whichever comes first, the Licensor hereby grants you rights under the terms of the Change License, and the rights granted in the paragraph above terminate.

111: If your use of the Licensed Work does not comply with the requirements currently in effect as described in this License, you must purchase a commercial license from the Licensor, its affiliated entities, or authorized resellers, or you must refrain from using the Licensed Work.

113: All copies of the original and modified Licensed Work, and derivative works of the Licensed Work, are subject to this License. This License applies separately for each version of the Licensed Work and the Change Date may vary for each version of the Licensed Work released by Licensor.

115: You must conspicuously display this License on each original or modified copy of the Licensed Work. If you receive the Licensed Work in original or modified form from a third party, the terms and conditions set forth in this License apply to your use of that work.

129: To specify as the Change License the GPL Version 2.0 or any later version, or a license that is compatible with GPL Version 2.0 or a later version, where “compatible” means that software provided under the Change License can be included in a program with software provided under GPL Version 2.0 or a later version. Licensor may specify additional Change Licenses without limitation.

131: To either: (a) specify an additional grant of rights to use that does not impose any additional restriction on the right granted in this License, as the Additional Use Grant; or (b) insert the text “None”.

133: To specify a Change Date.

135: Not to modify this License in any other way.

```

```solidity
File: contracts/UpsideProtocol.sol

282:             if (newLiquidityTokenReserves < INITIAL_LIQUIDITY_RESERVES) revert InsufficientLiquidity();

284:         if (_minimumOut > amountOut) revert InsufficientOutput();

338:         if (

370:         if (withdrawalAllowedBlockTimestamp > block.timestamp) revert CooldownTimerNotEnded();

409:         if (metaCoinInfo.isFreelyTransferable) revert AlreadyTransferable();

471: The Licensor hereby grants you the right to copy, modify, create derivative works, redistribute, and make non-production use of the Licensed Work. The Licensor may make an Additional Use Grant, above, permitting limited production use.

473: Effective on the Change Date, or the fourth anniversary of the first publicly available distribution of a specific version of the Licensed Work under this License, whichever comes first, the Licensor hereby grants you rights under the terms of the Change License, and the rights granted in the paragraph above terminate.

475: If your use of the Licensed Work does not comply with the requirements currently in effect as described in this License, you must purchase a commercial license from the Licensor, its affiliated entities, or authorized resellers, or you must refrain from using the Licensed Work.

477: All copies of the original and modified Licensed Work, and derivative works of the Licensed Work, are subject to this License. This License applies separately for each version of the Licensed Work and the Change Date may vary for each version of the Licensed Work released by Licensor.

479: You must conspicuously display this License on each original or modified copy of the Licensed Work. If you receive the Licensed Work in original or modified form from a third party, the terms and conditions set forth in this License apply to your use of that work.

493: To specify as the Change License the GPL Version 2.0 or any later version, or a license that is compatible with GPL Version 2.0 or a later version, where “compatible” means that software provided under the Change License can be included in a program with software provided under GPL Version 2.0 or a later version. Licensor may specify additional Change Licenses without limitation.

495: To either: (a) specify an additional grant of rights to use that does not impose any additional restriction on the right granted in this License, as the Additional Use Grant; or (b) insert the text “None”.

497: To specify a Change Date.

499: Not to modify this License in any other way.

```

### <a name="NC-3"></a>[NC-3] Consider disabling `renounceOwnership()`
If the plan for your project does not include eventually giving up all ownership control, consider overwriting OpenZeppelin's `Ownable`'s `renounceOwnership()` function in order to disable it.

*Instances (2)*:
```solidity
File: contracts/UpsideMetaCoin.sol

16: contract UpsideMetaCoin is ERC20, ERC20Permit, Ownable {

```

```solidity
File: contracts/UpsideProtocol.sol

15: contract UpsideProtocol is Ownable {

```

### <a name="NC-4"></a>[NC-4] Functions should not be longer than 50 lines
Overly complex code can make understanding functionality more difficult, try to further modularize your code to ensure readability 

*Instances (19)*:
```solidity
File: contracts/UpsideMetaCoin.sol

44:     function name() public view override returns (string memory) {

49:     function symbol() public view override returns (string memory) {

56:     function setNameAndSymbol(string memory _name, string memory _symbol) external onlyOwner {

73:     function transfer(address to, uint256 amount) public override isTransferAllowed returns (bool) {

80:     function transferFrom(address from, address to, uint256 amount) public override isTransferAllowed returns (bool) {

98:     function metaCoinInfoMap(address token) external returns (MetaCoinInfo memory);

99:     function metaCoinWhitelist(address token, address wallet) external returns (bool);

```

```solidity
File: contracts/UpsideProtocol.sol

106:     function metaCoinWhitelist(address _metaCoinAddress, address _walletAddress) external view returns (bool) {

117:     function tokenize(string calldata _url, address _tokenizeFeeAddress) external returns (address metaCoinAddress) {

301:     function claimDeployerFees(address _metaCoinAddress, address _recipient) external {

312:     function init(address _liquidityTokenAddress) external onlyOwner {

337:     function setFeeInfo(FeeInfo calldata _newFeeInfo) external onlyOwner {

357:     function withdrawLiquidity(address[] calldata _metaCoinAddresses) external onlyOwner {

402:     function disableWhitelist(address _metaCoinAddress) external onlyOwner {

417:     function claimProtocolFees(address _recipient) external onlyOwner {

427:     function setStakingContractAddress(address _newStakingContractAddress) external onlyOwner {

435:     function setTokenizeFee(address _tokenizeFeeAddress, uint256 _tokenizeFeeAmount) external onlyOwner {

462:     function distributeRewards(address _linkTokenAddress, uint256 _rewardTokenAmount) external;

463:     function whitelistStakingToken(address _metaCoinAddress) external;

```

### <a name="NC-5"></a>[NC-5] Lines are too long
Usually lines in source code are limited to [80](https://softwareengineering.stackexchange.com/questions/148677/why-is-80-characters-the-standard-limit-for-code-width) characters. Today's screens are much larger so it's reasonable to stretch this in some cases. Since the files will most likely reside in GitHub, and GitHub starts using a scroll bar in all cases when the length is over [164](https://github.com/aizatto/character-length) characters, the lines below should be split when they reach that length

*Instances (26)*:
```solidity
File: contracts/UpsideMetaCoin.sol

107: The Licensor hereby grants you the right to copy, modify, create derivative works, redistribute, and make non-production use of the Licensed Work. The Licensor may make an Additional Use Grant, above, permitting limited production use.

109: Effective on the Change Date, or the fourth anniversary of the first publicly available distribution of a specific version of the Licensed Work under this License, whichever comes first, the Licensor hereby grants you rights under the terms of the Change License, and the rights granted in the paragraph above terminate.

111: If your use of the Licensed Work does not comply with the requirements currently in effect as described in this License, you must purchase a commercial license from the Licensor, its affiliated entities, or authorized resellers, or you must refrain from using the Licensed Work.

113: All copies of the original and modified Licensed Work, and derivative works of the Licensed Work, are subject to this License. This License applies separately for each version of the Licensed Work and the Change Date may vary for each version of the Licensed Work released by Licensor.

115: You must conspicuously display this License on each original or modified copy of the Licensed Work. If you receive the Licensed Work in original or modified form from a third party, the terms and conditions set forth in this License apply to your use of that work.

117: Any use of the Licensed Work in violation of this License will automatically terminate your rights under this License for the current and all other versions of the Licensed Work.

119: This License does not grant you any right in any trademark or logo of Licensor or its affiliates (provided that you may use a trademark or logo of Licensor as expressly required by this License).

121: TO THE EXTENT PERMITTED BY APPLICABLE LAW, THE LICENSED WORK IS PROVIDED ON AN “AS IS” BASIS. LICENSOR HEREBY DISCLAIMS ALL WARRANTIES AND CONDITIONS, EXPRESS OR IMPLIED, INCLUDING (WITHOUT LIMITATION) WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND TITLE.

123: MariaDB hereby grants you permission to use this License’s text to license your works, and to refer to it using the trademark “Business Source License”, as long as you comply with the Covenants of Licensor below.

127: In consideration of the right to use this License’s text and the “Business Source License” name and trademark, Licensor covenants to MariaDB, and to all other recipients of the licensed work to be provided by Licensor:

129: To specify as the Change License the GPL Version 2.0 or any later version, or a license that is compatible with GPL Version 2.0 or a later version, where “compatible” means that software provided under the Change License can be included in a program with software provided under GPL Version 2.0 or a later version. Licensor may specify additional Change Licenses without limitation.

131: To either: (a) specify an additional grant of rights to use that does not impose any additional restriction on the right granted in this License, as the Additional Use Grant; or (b) insert the text “None”.

139: The Business Source License (this document, or the “License”) is not an Open Source license. However, the Licensed Work will eventually be made available under an Open Source License, as stated in this License.

```

```solidity
File: contracts/UpsideProtocol.sol

471: The Licensor hereby grants you the right to copy, modify, create derivative works, redistribute, and make non-production use of the Licensed Work. The Licensor may make an Additional Use Grant, above, permitting limited production use.

473: Effective on the Change Date, or the fourth anniversary of the first publicly available distribution of a specific version of the Licensed Work under this License, whichever comes first, the Licensor hereby grants you rights under the terms of the Change License, and the rights granted in the paragraph above terminate.

475: If your use of the Licensed Work does not comply with the requirements currently in effect as described in this License, you must purchase a commercial license from the Licensor, its affiliated entities, or authorized resellers, or you must refrain from using the Licensed Work.

477: All copies of the original and modified Licensed Work, and derivative works of the Licensed Work, are subject to this License. This License applies separately for each version of the Licensed Work and the Change Date may vary for each version of the Licensed Work released by Licensor.

479: You must conspicuously display this License on each original or modified copy of the Licensed Work. If you receive the Licensed Work in original or modified form from a third party, the terms and conditions set forth in this License apply to your use of that work.

481: Any use of the Licensed Work in violation of this License will automatically terminate your rights under this License for the current and all other versions of the Licensed Work.

483: This License does not grant you any right in any trademark or logo of Licensor or its affiliates (provided that you may use a trademark or logo of Licensor as expressly required by this License).

485: TO THE EXTENT PERMITTED BY APPLICABLE LAW, THE LICENSED WORK IS PROVIDED ON AN “AS IS” BASIS. LICENSOR HEREBY DISCLAIMS ALL WARRANTIES AND CONDITIONS, EXPRESS OR IMPLIED, INCLUDING (WITHOUT LIMITATION) WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND TITLE.

487: MariaDB hereby grants you permission to use this License’s text to license your works, and to refer to it using the trademark “Business Source License”, as long as you comply with the Covenants of Licensor below.

491: In consideration of the right to use this License’s text and the “Business Source License” name and trademark, Licensor covenants to MariaDB, and to all other recipients of the licensed work to be provided by Licensor:

493: To specify as the Change License the GPL Version 2.0 or any later version, or a license that is compatible with GPL Version 2.0 or a later version, where “compatible” means that software provided under the Change License can be included in a program with software provided under GPL Version 2.0 or a later version. Licensor may specify additional Change Licenses without limitation.

495: To either: (a) specify an additional grant of rights to use that does not impose any additional restriction on the right granted in this License, as the Additional Use Grant; or (b) insert the text “None”.

503: The Business Source License (this document, or the “License”) is not an Open Source license. However, the Licensed Work will eventually be made available under an Open Source License, as stated in this License.

```

### <a name="NC-6"></a>[NC-6] Take advantage of Custom Error's return value property
An important feature of Custom Error is that values such as address, tokenID, msg.value can be written inside the () sign, this kind of approach provides a serious advantage in debugging and examining the revert details of dapps such as tenderly.

*Instances (12)*:
```solidity
File: contracts/UpsideMetaCoin.sol

68:         ) revert NonTransferable();

```

```solidity
File: contracts/UpsideProtocol.sol

119:             revert MetaCoinExists();

128:                 revert TokenizeFeeInvalid();

176:             revert MetaCoinNonExistent();

260:             revert MetaCoinNonExistent();

282:             if (newLiquidityTokenReserves < INITIAL_LIQUIDITY_RESERVES) revert InsufficientLiquidity();

284:         if (_minimumOut > amountOut) revert InsufficientOutput();

348:             revert InvalidSetting();

370:         if (withdrawalAllowedBlockTimestamp > block.timestamp) revert CooldownTimerNotEnded();

406:             revert MetaCoinNonExistent();

409:         if (metaCoinInfo.isFreelyTransferable) revert AlreadyTransferable();

452:             revert MetaCoinNonExistent();

```

### <a name="NC-7"></a>[NC-7] Use scientific notation (e.g. `1e18`) rather than exponentiation (e.g. `10**18`)
While this won't save gas in the recent solidity versions, this is shorter and more readable (this is especially true in calculations).

*Instances (2)*:
```solidity
File: contracts/UpsideProtocol.sol

40:     uint256 private constant META_COIN_DEFAULT_TOTAL_SUPPLY = 1_000_000 * (10 ** 18);

41:     uint256 public constant INITIAL_LIQUIDITY_RESERVES = 10_000 * (10 ** 6);

```

### <a name="NC-8"></a>[NC-8] Avoid the use of sensitive terms
Use [alternative variants](https://www.zdnet.com/article/mysql-drops-master-slave-and-blacklist-whitelist-terminology/), e.g. allowlist/denylist instead of whitelist/blacklist

*Instances (15)*:
```solidity
File: contracts/UpsideMetaCoin.sol

66:             !upsideProtocol.metaCoinWhitelist(address(this), msg.sender) &&

99:     function metaCoinWhitelist(address token, address wallet) external returns (bool);

```

```solidity
File: contracts/UpsideProtocol.sol

51:     mapping(address metaCoinAddress => mapping(address walletAddress => bool isWhitelisted))

52:         private metaCoinWhitelistMap;

71:     event MetaCoinWhitelistSet(address metaCoinAddress, address walletAddress, bool isWhitelisted);

82:     event MetaCoinTransferabilitySet(address metaCoinAddress, bool whitelistDisabled);

106:     function metaCoinWhitelist(address _metaCoinAddress, address _walletAddress) external view returns (bool) {

110:         return metaCoinWhitelistMap[_metaCoinAddress][_walletAddress];

155:         IUpsideStaking(stakingContractAddress).whitelistStakingToken(metaCoinAddress);

321:     function setMetaCoinWhitelist(

324:         bool[] calldata _isWhitelisted

327:             metaCoinWhitelistMap[_metaCoinAddresses[i]][_walletAddresses[i]] = _isWhitelisted[i];

328:             emit MetaCoinWhitelistSet(_metaCoinAddresses[i], _walletAddresses[i], _isWhitelisted[i]);

402:     function disableWhitelist(address _metaCoinAddress) external onlyOwner {

463:     function whitelistStakingToken(address _metaCoinAddress) external;

```

### <a name="NC-9"></a>[NC-9] Use Underscores for Number Literals (add an underscore every 3 digits)

*Instances (10)*:
```solidity
File: contracts/UpsideMetaCoin.sol

105: License text copyright (c) 2017 MariaDB Corporation Ab, All Rights Reserved. “Business Source License” is a trademark of MariaDB Corporation Ab.

```

```solidity
File: contracts/UpsideProtocol.sol

213:             fee = (_tokenAmount * swapFeeBp) / 10000;

220:             fee = (_tokenAmount * feeInfo.swapFeeSellBp) / 10000;

223:             feeToDeployer = (fee * swapDeployerFeeBp) / 10000;

339:             _newFeeInfo.swapFeeDeployerBp > 10000 ||

340:             _newFeeInfo.swapFeeDecayBp > 10000 ||

341:             _newFeeInfo.swapFeeFinalBp > 10000 ||

342:             _newFeeInfo.swapFeeStartingBp > 10000 ||

343:             _newFeeInfo.swapFeeSellBp > 10000 ||

469: License text copyright (c) 2017 MariaDB Corporation Ab, All Rights Reserved. “Business Source License” is a trademark of MariaDB Corporation Ab.

```


## Low Issues


| |Issue|Instances|
|-|:-|:-:|
| [L-1](#L-1) | `approve()`/`safeApprove()` may revert if the current approval is not zero | 1 |
| [L-2](#L-2) | Use a 2-step ownership transfer pattern | 2 |
| [L-3](#L-3) | Division by zero not prevented | 2 |
| [L-4](#L-4) | Initializers could be front-run | 1 |
| [L-5](#L-5) | Signature use at deadlines should be allowed | 1 |
| [L-6](#L-6) | Possible rounding issue | 2 |
| [L-7](#L-7) | Use `Ownable2Step.transferOwnership` instead of `Ownable.transferOwnership` | 2 |
| [L-8](#L-8) | Unsafe ERC20 operation(s) | 1 |
### <a name="L-1"></a>[L-1] `approve()`/`safeApprove()` may revert if the current approval is not zero
- Some tokens (like the *very popular* USDT) do not work when changing the allowance from an existing non-zero allowance value (it will revert if the current approval is not zero to protect against front-running changes of approvals). These tokens must first be approved for zero and then the actual allowance can be approved.
- Furthermore, OZ's implementation of safeApprove would throw an error if an approve is attempted from a non-zero value (`"SafeERC20: approve from non-zero to non-zero allowance"`)

Set the allowance to zero immediately before each of the existing allowance calls

*Instances (1)*:
```solidity
File: contracts/UpsideProtocol.sol

227:             IERC20Metadata(_metaCoinAddress).approve(stakingContractAddress, feeToStakers);

```

### <a name="L-2"></a>[L-2] Use a 2-step ownership transfer pattern
Recommend considering implementing a two step process where the owner or admin nominates an account and the nominated account needs to call an `acceptOwnership()` function for the transfer of ownership to fully succeed. This ensures the nominated EOA account is a valid and active account. Lack of two-step procedure for critical operations leaves them error-prone. Consider adding two step procedure on the critical functions.

*Instances (2)*:
```solidity
File: contracts/UpsideMetaCoin.sol

16: contract UpsideMetaCoin is ERC20, ERC20Permit, Ownable {

```

```solidity
File: contracts/UpsideProtocol.sol

15: contract UpsideProtocol is Ownable {

```

### <a name="L-3"></a>[L-3] Division by zero not prevented
The divisions below take an input parameter which does not have any zero-value checks, which may lead to the functions reverting when zero is passed.

*Instances (2)*:
```solidity
File: contracts/UpsideProtocol.sol

180:         uint256 intervalsElapsed = secondsPassed / fee.swapFeeDecayInterval;

275:             amountOut = (metaCoinInfo.metaCoinReserves * amountInAfterFee) / newLiquidityTokenReserves;

```

### <a name="L-4"></a>[L-4] Initializers could be front-run
Initializers could be front-run, allowing an attacker to either set their own values, take ownership of the contract, and in the best case forcing a re-deployment

*Instances (1)*:
```solidity
File: contracts/UpsideProtocol.sol

312:     function init(address _liquidityTokenAddress) external onlyOwner {

```

### <a name="L-5"></a>[L-5] Signature use at deadlines should be allowed
According to [EIP-2612](https://github.com/ethereum/EIPs/blob/71dc97318013bf2ac572ab63fab530ac9ef419ca/EIPS/eip-2612.md?plain=1#L58), signatures used on exactly the deadline timestamp are supposed to be allowed. While the signature may or may not be used for the exact EIP-2612 use case (transfer approvals), for consistency's sake, all deadlines should follow this semantic. If the timestamp is an expiration rather than a deadline, consider whether it makes more sense to include the expiration timestamp as a valid timestamp, as is done for deadlines.

*Instances (1)*:
```solidity
File: contracts/UpsideProtocol.sol

370:         if (withdrawalAllowedBlockTimestamp > block.timestamp) revert CooldownTimerNotEnded();

```

### <a name="L-6"></a>[L-6] Possible rounding issue
Division by large numbers may result in the result being zero, due to solidity not supporting fractions. Consider requiring a minimum amount for the numerator to ensure that it is always larger than the denominator. Also, there is indication of multiplication and division without the use of parenthesis which could result in issues.

*Instances (2)*:
```solidity
File: contracts/UpsideProtocol.sol

275:             amountOut = (metaCoinInfo.metaCoinReserves * amountInAfterFee) / newLiquidityTokenReserves;

279:             amountOut = (metaCoinInfo.liquidityTokenReserves * amountInAfterFee) / newMetaCoinReserves;

```

### <a name="L-7"></a>[L-7] Use `Ownable2Step.transferOwnership` instead of `Ownable.transferOwnership`
Use [Ownable2Step.transferOwnership](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable2Step.sol) which is safer. Use it as it is more secure due to 2-stage ownership transfer.

**Recommended Mitigation Steps**

Use <a href="https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable2Step.sol">Ownable2Step.sol</a>
  
  ```solidity
      function acceptOwnership() external {
          address sender = _msgSender();
          require(pendingOwner() == sender, "Ownable2Step: caller is not the new owner");
          _transferOwnership(sender);
      }
```

*Instances (2)*:
```solidity
File: contracts/UpsideMetaCoin.sol

12: import "@openzeppelin/contracts/access/Ownable.sol";

```

```solidity
File: contracts/UpsideProtocol.sol

12: import "@openzeppelin/contracts/access/Ownable.sol";

```

### <a name="L-8"></a>[L-8] Unsafe ERC20 operation(s)

*Instances (1)*:
```solidity
File: contracts/UpsideProtocol.sol

227:             IERC20Metadata(_metaCoinAddress).approve(stakingContractAddress, feeToStakers);

```


## Medium Issues


| |Issue|Instances|
|-|:-|:-:|
| [M-1](#M-1) | Centralization Risk for trusted owners | 14 |
### <a name="M-1"></a>[M-1] Centralization Risk for trusted owners

#### Impact:
Contracts have owners with privileged rights to perform admin tasks and need to be trusted to not perform malicious updates or drain funds.

*Instances (14)*:
```solidity
File: contracts/UpsideMetaCoin.sol

16: contract UpsideMetaCoin is ERC20, ERC20Permit, Ownable {

36:     ) ERC20(_name, _symbol) Ownable(msg.sender) ERC20Permit(_name) {

56:     function setNameAndSymbol(string memory _name, string memory _symbol) external onlyOwner {

```

```solidity
File: contracts/UpsideProtocol.sol

15: contract UpsideProtocol is Ownable {

100:     constructor(address _owner) Ownable(_owner) {}

312:     function init(address _liquidityTokenAddress) external onlyOwner {

325:     ) external onlyOwner {

337:     function setFeeInfo(FeeInfo calldata _newFeeInfo) external onlyOwner {

357:     function withdrawLiquidity(address[] calldata _metaCoinAddresses) external onlyOwner {

402:     function disableWhitelist(address _metaCoinAddress) external onlyOwner {

417:     function claimProtocolFees(address _recipient) external onlyOwner {

427:     function setStakingContractAddress(address _newStakingContractAddress) external onlyOwner {

435:     function setTokenizeFee(address _tokenizeFeeAddress, uint256 _tokenizeFeeAmount) external onlyOwner {

448:     ) external onlyOwner {

```
