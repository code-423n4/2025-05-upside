// SPDX-License-Identifier: BUSL-1.1
/*
Licensor:           Moai Labs LLC
Licensed Works:     This Contract
Change Date:        4 years after initial deployment of this contract.
Change License:     GNU General Public License v2.0 or later
*/
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./UpsideMetaCoin.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract UpsideProtocol is Ownable {
    using SafeERC20 for IERC20Metadata;

    struct MetaCoinInfo {
        address deployer;
        bool isFreelyTransferable;
        uint256 liquidityTokenReserves;
        uint256 metaCoinReserves;
        uint256 createdAtUnix;
    }

    struct FeeInfo {
        address tokenizeFeeDestinationAddress;
        uint32 swapFeeDecayInterval;
        bool tokenizeFeeEnabled;
        uint16 swapFeeStartingBp;
        uint16 swapFeeDecayBp;
        uint16 swapFeeFinalBp;
        uint16 swapFeeSellBp;
        uint16 swapFeeDeployerBp;
    }

    // @dev Constants
    string private constant META_COIN_DEFAULT_NAME = "UPSIDE";
    string private constant META_COIN_DEFAULT_SYMBOL = "UPSIDE";
    uint256 private constant META_COIN_DEFAULT_TOTAL_SUPPLY = 1_000_000 * (10 ** 18);
    uint256 public constant INITIAL_LIQUIDITY_RESERVES = 10_000 * (10 ** 6);
    uint256 public constant WITHDRAW_LIQUIDITY_COOLDOWN = 14 days;

    address public liquidityTokenAddress;
    address public stakingContractAddress;
    uint256 public withdrawLiquidityTimerStartTime;
    uint256 public claimableProtocolFees; // @dev This is always in liquidity tokens
    FeeInfo public feeInfo;
    uint256 public minSellAmount;

    // @dev stores data on which addresses are whitelisted to transfer MetaCoins (per meta coin)
    mapping(address metaCoinAddress => mapping(address walletAddress => bool isWhitelisted))
        private metaCoinWhitelistMap;
    mapping(address metaCoinAddress => MetaCoinInfo) public metaCoinInfoMap;
    mapping(string url => address metaCoinAddress) public urlToMetaCoinMap;
    // @dev This is always in MetaCoins (not liquidity tokens)
    mapping(address metaCoinAddress => mapping(address walletAddress => uint256 deployerFeeClaimable))
        public claimableDeployerFees;
    mapping(address tokenizeFeeAddress => uint256 tokenizeFeeAmount) public tokenizeFeeMap;

    event UrlTokenized(address metaCoinAddress, string url);
    event FeeInfoSet(FeeInfo feeInfo);
    event Trade(
        address metaCoinAddress,
        bool isBuy,
        address sender,
        uint256 tokenAmount,
        uint256 tokenAmountAfterFee,
        uint256 amountOut,
        address recipient
    );
    event MetaCoinWhitelistSet(address metaCoinAddress, address walletAddress, bool isWhitelisted);
    event SwapFeeProcessed(
        address metaCoinAddress,
        bool isBuy,
        uint256 secondsPassed,
        uint256 swapFeeBp,
        uint256 totalFee, // Total fee for the swap
        uint256 feeToProtocol, // Only used for buy swaps
        uint256 feeToDeployer, // Only used for sell swaps
        uint256 feeToStakers // Only used for sell swaps
    );
    event MetaCoinTransferabilitySet(address metaCoinAddress, bool whitelistDisabled);
    event LiquidityWithdrawn(address metaCoinAddress, uint256 liquidityTokenReserves, uint256 metaCoinReserves);
    event ProtocolFeeClaimed(uint256 totalFeeClaimed, address recipient);
    event DeployerFeeClaimed(address metaCoinAddress, uint256 tokenAmount, address recipient);
    event WithdrawLiquidityTimerStarted(uint256 functionEnabledFromTs);
    event StakingContractAddressSet(address stakingContractAddress);
    event TokenizeFeeSet(address tokenizeFeeAddress, uint256 tokenizeFeeAmount);
    event MetaCoinNameSymbolSet(address metaCoinAddress, string name, string symbol);

    error MetaCoinExists();
    error MetaCoinNonExistent();
    error InsufficientOutput();
    error InsufficientLiquidity();
    error InvalidSetting();
    error AlreadyTransferable();
    error CooldownTimerNotEnded();
    error TokenizeFeeInvalid();

    constructor(address _owner) Ownable(_owner) {}

    /// @notice Returns true/false based on whether token transfer should be allowed
    /// @param _metaCoinAddress Address of the MetaCoin
    /// @param _walletAddress The wallet address to check on the whitelist
    /// @return True or false
    function metaCoinWhitelist(address _metaCoinAddress, address _walletAddress) external view returns (bool) {
        if (_walletAddress == address(this) || _walletAddress == stakingContractAddress) {
            return true;
        }
        return metaCoinWhitelistMap[_metaCoinAddress][_walletAddress];
    }

    /// @notice Allows anyone to tokenize any url
    /// @param _url The url to tokenize
    /// @return metaCoinAddress The address of the newly deployed MetaCoin
    /// @dev This function may require a fee to be paid in "tokenizeFeeToken"
    function tokenize(string calldata _url, address _tokenizeFeeAddress) external returns (address metaCoinAddress) {
        if (urlToMetaCoinMap[_url] != address(0)) {
            revert MetaCoinExists();
        }

        FeeInfo storage fee = feeInfo;

        // Handle tokenize fee
        // @dev We want to be able to accept many different ERC20 tokens as opposed to just one
        if (fee.tokenizeFeeEnabled) {
            if (tokenizeFeeMap[_tokenizeFeeAddress] == 0) {
                revert TokenizeFeeInvalid();
            }
            IERC20Metadata(_tokenizeFeeAddress).safeTransferFrom(
                msg.sender,
                fee.tokenizeFeeDestinationAddress,
                tokenizeFeeMap[_tokenizeFeeAddress]
            );
        }

        metaCoinAddress = address(
            new UpsideMetaCoin(
                META_COIN_DEFAULT_NAME,
                META_COIN_DEFAULT_SYMBOL,
                META_COIN_DEFAULT_TOTAL_SUPPLY,
                address(this)
            )
        );
        urlToMetaCoinMap[_url] = metaCoinAddress;

        metaCoinInfoMap[metaCoinAddress] = MetaCoinInfo(
            msg.sender,
            false,
            INITIAL_LIQUIDITY_RESERVES,
            META_COIN_DEFAULT_TOTAL_SUPPLY,
            block.timestamp
        );

        IUpsideStaking(stakingContractAddress).whitelistStakingToken(metaCoinAddress);

        emit UrlTokenized(metaCoinAddress, _url);
        return metaCoinAddress;
    }

    /// @notice Computes the Time Fee (swap fee) for any given valid MetaCoin address
    /// @param _metaCoinAddress The address of the MetaCoin to compute for
    /// @return secondsPassed The number of seconds passed since deployment
    /// @return swapFeeBp The swap percentage fee in basis-points (bp)
    /// @return deployerFeeBp The deployer percentage fee in basis-points (bp)
    /// @dev Swap fee is what's taken from the user. Deployer fee is a percentage of the swap fee.
    /// @dev EG: Input is 100, swap fee is 10% = 10. Deployer fee is 10% = 1
    /// @dev Expectation is there will always be a fee >0
    function computeTimeFee(
        address _metaCoinAddress
    ) public view returns (uint256 secondsPassed, uint256 swapFeeBp, uint256 deployerFeeBp) {
        MetaCoinInfo storage metaCoinInfo = metaCoinInfoMap[_metaCoinAddress];
        FeeInfo storage fee = feeInfo;

        if (metaCoinInfo.deployer == address(0)) {
            revert MetaCoinNonExistent();
        }

        secondsPassed = block.timestamp - metaCoinInfo.createdAtUnix;
        uint256 intervalsElapsed = secondsPassed / fee.swapFeeDecayInterval;
        uint256 feeReduction = intervalsElapsed * fee.swapFeeDecayBp;

        if (feeReduction >= (fee.swapFeeStartingBp - fee.swapFeeFinalBp)) {
            swapFeeBp = fee.swapFeeFinalBp;
        } else {
            swapFeeBp = fee.swapFeeStartingBp - feeReduction;
        }
        deployerFeeBp = fee.swapFeeDeployerBp;
    }

    /// @notice Used internally to handle swap fees
    /// @param _metaCoinAddress The MetaCoin address to process swap fees for
    /// @param _isBuy Flag to define if this is a BUY or SELL. BUY = true
    /// @param _tokenAmount The number of tokens the user is providing to swap
    /// @param _deployer The address of the MetaCoin deployer
    /// @return tokenAmountAfterFee The token amount used within the bonding curve after fees are deducted
    /// @dev Expectation is there will always be a fee >0
    function processSwapFee(
        address _metaCoinAddress,
        bool _isBuy,
        uint256 _tokenAmount,
        address _deployer
    ) internal returns (uint256 tokenAmountAfterFee) {
        (uint256 secondsPassed, uint256 swapFeeBp, uint256 swapDeployerFeeBp) = computeTimeFee(_metaCoinAddress);

        uint256 fee;
        uint256 feeToProtocol;
        uint256 feeToDeployer;
        uint256 feeToStakers;

        if (_isBuy) {
            // @dev On buy, the dynamic time fee is used
            uint256 minBuyAmount = 10000 / swapFeeBp;
            require(
                _tokenAmount >= minBuyAmount,
                string.concat(
                    "Insufficient input: please swap at least ",
                    Strings.toString(minBuyAmount),
                    " tokens"
                )
            );
            fee = (_tokenAmount * swapFeeBp) / 10000;
            tokenAmountAfterFee = _tokenAmount - fee;

            claimableProtocolFees += fee;
            feeToProtocol = fee;
        } else {
            // @dev On sell, a static percentage bp is used (impl could be significantly improved to save gas)
            require(
                _tokenAmount >= minSellAmount,
                string.concat(
                    "Insufficient input: please swap at least ",
                    Strings.toString(minSellAmount),
                    " tokens"
                )
            );
            fee = (_tokenAmount * feeInfo.swapFeeSellBp) / 10000;
            tokenAmountAfterFee = _tokenAmount - fee;

            feeToDeployer = (fee * swapDeployerFeeBp) / 10000;
            claimableDeployerFees[_metaCoinAddress][_deployer] += feeToDeployer;
            feeToStakers = fee - feeToDeployer;

            IERC20Metadata(_metaCoinAddress).approve(stakingContractAddress, feeToStakers);
            IUpsideStaking(stakingContractAddress).distributeRewards(_metaCoinAddress, feeToStakers);
        }

        emit SwapFeeProcessed(
            _metaCoinAddress,
            _isBuy,
            secondsPassed,
            _isBuy ? swapFeeBp : feeInfo.swapFeeSellBp,
            fee,
            feeToProtocol,
            feeToDeployer,
            feeToStakers
        );
    }

    /// @notice Allows users to swap tokens in both directions
    /// @param _metaCoinAddress The MetaCoin address to swap
    /// @param _isBuy Flag to define if this is a BUY or SELL. BUY = true
    /// @param _tokenAmount The number of tokens to swap
    /// @param _minimumOut The minimum number of tokens to get back
    /// @param _recipient The address to send the output tokens to
    /// @return amountOut The number of tokens resulting from the swap
    function swap(
        address _metaCoinAddress,
        bool _isBuy,
        uint256 _tokenAmount,
        uint256 _minimumOut,
        address _recipient
    ) external returns (uint256 amountOut) {
        MetaCoinInfo storage metaCoinInfo = metaCoinInfoMap[_metaCoinAddress];

        if (metaCoinInfo.deployer == address(0)) {
            revert MetaCoinNonExistent();
        }

        if (_isBuy) {
            IERC20Metadata(liquidityTokenAddress).safeTransferFrom(msg.sender, address(this), _tokenAmount);
        } else {
            IERC20Metadata(_metaCoinAddress).safeTransferFrom(msg.sender, address(this), _tokenAmount);
        }

        uint256 amountInAfterFee = processSwapFee(_metaCoinAddress, _isBuy, _tokenAmount, metaCoinInfo.deployer);

        uint256 newLiquidityTokenReserves;
        uint256 newMetaCoinReserves;
        if (_isBuy) {
            newLiquidityTokenReserves = metaCoinInfo.liquidityTokenReserves + amountInAfterFee;
            amountOut = (metaCoinInfo.metaCoinReserves * amountInAfterFee) / newLiquidityTokenReserves;
            newMetaCoinReserves = metaCoinInfo.metaCoinReserves - amountOut;
        } else {
            newMetaCoinReserves = metaCoinInfo.metaCoinReserves + amountInAfterFee;
            amountOut = (metaCoinInfo.liquidityTokenReserves * amountInAfterFee) / newMetaCoinReserves;
            newLiquidityTokenReserves = metaCoinInfo.liquidityTokenReserves - amountOut;

            if (newLiquidityTokenReserves < INITIAL_LIQUIDITY_RESERVES) revert InsufficientLiquidity();
        }
        if (_minimumOut > amountOut) revert InsufficientOutput();

        metaCoinInfo.liquidityTokenReserves = newLiquidityTokenReserves;
        metaCoinInfo.metaCoinReserves = newMetaCoinReserves;

        emit Trade(_metaCoinAddress, _isBuy, msg.sender, _tokenAmount, amountInAfterFee, amountOut, _recipient);

        if (_isBuy) {
            IERC20Metadata(_metaCoinAddress).safeTransfer(_recipient, amountOut);
        } else {
            IERC20Metadata(liquidityTokenAddress).safeTransfer(_recipient, amountOut);
        }
    }

    /// @notice Allows deployers of MetaCoin's to claim their generated fees
    /// @param _metaCoinAddress Address of the MetaCoin to claim fees from
    /// @param _recipient Address where claimed deployer fees should be sent to
    function claimDeployerFees(address _metaCoinAddress, address _recipient) external {
        uint256 fees = claimableDeployerFees[_metaCoinAddress][msg.sender];
        claimableDeployerFees[_metaCoinAddress][msg.sender] = 0;
        emit DeployerFeeClaimed(_metaCoinAddress, fees, _recipient);

        IERC20Metadata(_metaCoinAddress).safeTransfer(_recipient, fees);
    }

    /// @notice Allows the owner of the contract to initialize the contract
    /// @param _liquidityTokenAddress The liquidity token address that should be used moving forward
    /// @dev This function can only be called once.
    function init(address _liquidityTokenAddress) external onlyOwner {
        require(liquidityTokenAddress == address(0), "ALREADY INITIALISED");
        liquidityTokenAddress = _liquidityTokenAddress;
    }

    /// @notice Allows Owner to set whitelisted addresses which controls who can transfer MetaCoin per MetaCoin
    /// @param _metaCoinAddresses Array of MetaCoin addresses to update
    /// @param _walletAddresses Array of wallet addresses to set whitelist flag for
    /// @param _isWhitelisted Array of boolean's setting whitelist flag. True = whitelisted
    function setMetaCoinWhitelist(
        address[] calldata _metaCoinAddresses,
        address[] calldata _walletAddresses,
        bool[] calldata _isWhitelisted
    ) external onlyOwner {
        for (uint256 i; i < _metaCoinAddresses.length; ) {
            metaCoinWhitelistMap[_metaCoinAddresses[i]][_walletAddresses[i]] = _isWhitelisted[i];
            emit MetaCoinWhitelistSet(_metaCoinAddresses[i], _walletAddresses[i], _isWhitelisted[i]);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Allows Owner to set Swap Fee and Tokenize Fee settings
    /// @param _newFeeInfo Struct with Swap Fee and Tokenize Fee settings
    function setFeeInfo(FeeInfo calldata _newFeeInfo) external onlyOwner {
        if (
            _newFeeInfo.swapFeeDeployerBp > 10000 ||
            _newFeeInfo.swapFeeDecayBp > 10000 ||
            _newFeeInfo.swapFeeFinalBp > 10000 ||
            _newFeeInfo.swapFeeStartingBp > 10000 ||
            _newFeeInfo.swapFeeSellBp > 10000 ||
            _newFeeInfo.tokenizeFeeDestinationAddress == address(0) ||
            _newFeeInfo.swapFeeStartingBp < _newFeeInfo.swapFeeFinalBp ||
            _newFeeInfo.swapFeeDecayInterval == 0
        ) {
            revert InvalidSetting();
        }

        feeInfo = _newFeeInfo;
        minSellAmount = 10000 / feeInfo.swapFeeSellBp;
        emit FeeInfoSet(_newFeeInfo);
    }

    /// @notice Allows Owner to withdraw liquidity from bonding curves
    /// @param _metaCoinAddresses An array of MetaCoin addresses to withdraw liquidity from
    function withdrawLiquidity(address[] calldata _metaCoinAddresses) external onlyOwner {
        /// @dev A GLOBAL timer is used - this impacts ALL MetaCoin's past and future
        // If the timer was not started, start it
        if (withdrawLiquidityTimerStartTime == 0) {
            withdrawLiquidityTimerStartTime = block.timestamp;

            // Emit event so it can be tracked
            emit WithdrawLiquidityTimerStarted(block.timestamp + WITHDRAW_LIQUIDITY_COOLDOWN);
            return;
        }

        // Ensure if the countdown was started, the entire cooldown period has passed
        uint256 withdrawalAllowedBlockTimestamp = withdrawLiquidityTimerStartTime + WITHDRAW_LIQUIDITY_COOLDOWN;
        if (withdrawalAllowedBlockTimestamp > block.timestamp) revert CooldownTimerNotEnded();

        // Withdrawal logic
        uint256 tokensToWithdraw;

        for (uint256 i; i < _metaCoinAddresses.length; ) {
            MetaCoinInfo storage metaCoinInfo = metaCoinInfoMap[_metaCoinAddresses[i]];
            uint256 liquidityTokensInCurve = metaCoinInfo.liquidityTokenReserves - INITIAL_LIQUIDITY_RESERVES;
            uint256 metaTokensInCurve = metaCoinInfo.metaCoinReserves;

            // Update the reserve
            metaCoinInfo.liquidityTokenReserves = INITIAL_LIQUIDITY_RESERVES;
            metaCoinInfo.metaCoinReserves = 0;

            // Add withdrawal of liquidity tokens to running sum (for transfer later in one go)
            tokensToWithdraw += liquidityTokensInCurve;

            // Transfer MetaCoin
            IERC20Metadata(_metaCoinAddresses[i]).safeTransfer(msg.sender, metaTokensInCurve);

            emit LiquidityWithdrawn(_metaCoinAddresses[i], liquidityTokensInCurve, metaTokensInCurve);
            unchecked {
                ++i;
            }
        }

        // Transfer the total number of liquidity tokens
        IERC20Metadata(liquidityTokenAddress).safeTransfer(msg.sender, tokensToWithdraw);
    }

    /// @notice Allows Owner to disable whitelist for specific MetaCoins
    /// @dev This can only be called once and is permanent for that MetaCoin
    function disableWhitelist(address _metaCoinAddress) external onlyOwner {
        MetaCoinInfo storage metaCoinInfo = metaCoinInfoMap[_metaCoinAddress];

        if (metaCoinInfo.deployer == address(0)) {
            revert MetaCoinNonExistent();
        }

        if (metaCoinInfo.isFreelyTransferable) revert AlreadyTransferable();

        metaCoinInfo.isFreelyTransferable = true;
        emit MetaCoinTransferabilitySet(_metaCoinAddress, true);
    }

    /// @notice Allows Owner to claim protocol fees
    /// @param _recipient The address where the claimed protocol fees should be sent to
    function claimProtocolFees(address _recipient) external onlyOwner {
        uint256 fees = claimableProtocolFees;
        claimableProtocolFees = 0;
        emit ProtocolFeeClaimed(fees, _recipient);

        IERC20Metadata(liquidityTokenAddress).safeTransfer(_recipient, fees);
    }

    /// @notice Allows Owner to update staking contract address
    /// @param _newStakingContractAddress Address of the new staking contract address
    function setStakingContractAddress(address _newStakingContractAddress) external onlyOwner {
        stakingContractAddress = _newStakingContractAddress;
        emit StakingContractAddressSet(_newStakingContractAddress);
    }

    /// @notice Allows Owner to set tokenize fee per token address
    /// @param _tokenizeFeeAddress Token address to set
    /// @param _tokenizeFeeAmount Tokenize fee amount for this tokenize fee address
    function setTokenizeFee(address _tokenizeFeeAddress, uint256 _tokenizeFeeAmount) external onlyOwner {
        tokenizeFeeMap[_tokenizeFeeAddress] = _tokenizeFeeAmount;
        emit TokenizeFeeSet(_tokenizeFeeAddress, _tokenizeFeeAmount);
    }

    /// @notice Allows Owner to set new ERC20 name and symbol for specific MetaCoin
    /// @param _metaCoinAddress The MetaCoin address to update
    /// @param _name The new ERC20 name
    /// @param _symbol The new ERC20 symbol
    function setMetaCoinNameSymbol(
        address _metaCoinAddress,
        string memory _name,
        string memory _symbol
    ) external onlyOwner {
        MetaCoinInfo storage metaCoinInfo = metaCoinInfoMap[_metaCoinAddress];

        if (metaCoinInfo.deployer == address(0)) {
            revert MetaCoinNonExistent();
        }

        UpsideMetaCoin(_metaCoinAddress).setNameAndSymbol(_name, _symbol);

        emit MetaCoinNameSymbolSet(_metaCoinAddress, _name, _symbol);
    }
}

interface IUpsideStaking {
    function distributeRewards(address _linkTokenAddress, uint256 _rewardTokenAmount) external;
    function whitelistStakingToken(address _metaCoinAddress) external;
}

/*
Business Source License 1.1

License text copyright (c) 2017 MariaDB Corporation Ab, All Rights Reserved. “Business Source License” is a trademark of MariaDB Corporation Ab.

The Licensor hereby grants you the right to copy, modify, create derivative works, redistribute, and make non-production use of the Licensed Work. The Licensor may make an Additional Use Grant, above, permitting limited production use.

Effective on the Change Date, or the fourth anniversary of the first publicly available distribution of a specific version of the Licensed Work under this License, whichever comes first, the Licensor hereby grants you rights under the terms of the Change License, and the rights granted in the paragraph above terminate.

If your use of the Licensed Work does not comply with the requirements currently in effect as described in this License, you must purchase a commercial license from the Licensor, its affiliated entities, or authorized resellers, or you must refrain from using the Licensed Work.

All copies of the original and modified Licensed Work, and derivative works of the Licensed Work, are subject to this License. This License applies separately for each version of the Licensed Work and the Change Date may vary for each version of the Licensed Work released by Licensor.

You must conspicuously display this License on each original or modified copy of the Licensed Work. If you receive the Licensed Work in original or modified form from a third party, the terms and conditions set forth in this License apply to your use of that work.

Any use of the Licensed Work in violation of this License will automatically terminate your rights under this License for the current and all other versions of the Licensed Work.

This License does not grant you any right in any trademark or logo of Licensor or its affiliates (provided that you may use a trademark or logo of Licensor as expressly required by this License).

TO THE EXTENT PERMITTED BY APPLICABLE LAW, THE LICENSED WORK IS PROVIDED ON AN “AS IS” BASIS. LICENSOR HEREBY DISCLAIMS ALL WARRANTIES AND CONDITIONS, EXPRESS OR IMPLIED, INCLUDING (WITHOUT LIMITATION) WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND TITLE.

MariaDB hereby grants you permission to use this License’s text to license your works, and to refer to it using the trademark “Business Source License”, as long as you comply with the Covenants of Licensor below.

Covenants of Licensor

In consideration of the right to use this License’s text and the “Business Source License” name and trademark, Licensor covenants to MariaDB, and to all other recipients of the licensed work to be provided by Licensor:

To specify as the Change License the GPL Version 2.0 or any later version, or a license that is compatible with GPL Version 2.0 or a later version, where “compatible” means that software provided under the Change License can be included in a program with software provided under GPL Version 2.0 or a later version. Licensor may specify additional Change Licenses without limitation.

To either: (a) specify an additional grant of rights to use that does not impose any additional restriction on the right granted in this License, as the Additional Use Grant; or (b) insert the text “None”.

To specify a Change Date.

Not to modify this License in any other way.

Notice

The Business Source License (this document, or the “License”) is not an Open Source license. However, the Licensed Work will eventually be made available under an Open Source License, as stated in this License.
*/
