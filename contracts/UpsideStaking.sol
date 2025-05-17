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

contract UpsideStaking is Ownable {
    using SafeERC20 for IERC20Metadata;

    event Claimed(address metaCoinAddress, uint256 rewardTokenAmount);
    event Unstaked(address metaCoinAddress, uint256 tokenAmount);
    event Staked(address metaCoinAddress, uint256 tokenAmount);
    event RewardDistributed(address metaCoinAddress, uint256 rewardTokenAmount, bool distributed);
    event ProtocolFeeRecipientSet(address oldRecipient, address newRecipient);
    event ProtocolFeeClaimed(address metaCoinAddress, uint256 tokenAmountClaimed);
    event WhitelistSet(address metaCoinAddress);

    uint256 private constant MULTIPLIER = 1e18;

    mapping(address metaCoinAddress => bool allowed) public whitelistedStakingTokens;
    mapping(address metaCoinAddress => mapping(address walletAddress => uint256 stakedBalance)) public balanceOf;
    mapping(address metaCoinAddress => uint256 totalSupply) public totalSupplies;
    mapping(address metaCoinAddress => uint256 rewardIndexValue) public rewardIndex;
    mapping(address metaCoinAddress => mapping(address => uint256)) public rewardIndexOf;
    mapping(address metaCoinAddress => mapping(address => uint256)) public earned;
    mapping(address metaCoinAddress => uint256 totalClaimable) public protocolFees;

    address public protocolFeeRecipient;

    error Unauthorised();
    error TokenNotWhitelisted();

    /// @notice Constructor that sets the owner and the protocol fee recipient
    /// @param _owner The address of the contract owner
    /// @param _protocolFeeRecipient The initial protocol fee recipient
    constructor(address _owner, address _protocolFeeRecipient) Ownable(_owner) {
        protocolFeeRecipient = _protocolFeeRecipient;
        emit ProtocolFeeRecipientSet(address(0), _protocolFeeRecipient);
    }

    /// @notice Distributes rewards to stakers or as protocol fees if no one is staked
    /// @param _metaCoinAddress The address of the token for which rewards are distributed
    /// @param _rewardTokenAmount The amount of tokens to distribute as rewards
    function distributeRewards(address _metaCoinAddress, uint256 _rewardTokenAmount) external {
        if (!whitelistedStakingTokens[_metaCoinAddress]) revert TokenNotWhitelisted();

        uint256 _totalSupply = totalSupplies[_metaCoinAddress];
        if (_totalSupply == 0) {
            // If no tokens are staked, add the reward amount to protocol fees.
            protocolFees[_metaCoinAddress] += _rewardTokenAmount;
            emit RewardDistributed(_metaCoinAddress, _rewardTokenAmount, false);
        } else {
            // Otherwise, update the reward index for the token.
            rewardIndex[_metaCoinAddress] += (_rewardTokenAmount * MULTIPLIER) / _totalSupply;
            emit RewardDistributed(_metaCoinAddress, _rewardTokenAmount, true);
        }
        IERC20Metadata(_metaCoinAddress).safeTransferFrom(msg.sender, address(this), _rewardTokenAmount);
    }

    /// @notice Calculates the rewards for a staker based on their staked amount
    /// @param _metaCoinAddress The token address
    /// @param _account The staker's address
    /// @return The reward amount calculated
    function _calculateRewards(address _metaCoinAddress, address _account) private view returns (uint256) {
        uint256 _shares = balanceOf[_metaCoinAddress][_account];
        return (_shares * (rewardIndex[_metaCoinAddress] - rewardIndexOf[_metaCoinAddress][_account])) / MULTIPLIER;
    }

    /// @notice Returns the total rewards earned by an account for a given token
    /// @param _metaCoinAddress The token address
    /// @param _account The staker's address
    /// @return The total rewards earned
    function calculateRewardsEarned(address _metaCoinAddress, address _account) external view returns (uint256) {
        return earned[_metaCoinAddress][_account] + _calculateRewards(_metaCoinAddress, _account);
    }

    /// @notice Updates the reward information for a staker
    /// @param _metaCoinAddress The token address
    /// @param _account The staker's address
    function _updateRewards(address _metaCoinAddress, address _account) private {
        earned[_metaCoinAddress][_account] += _calculateRewards(_metaCoinAddress, _account);
        rewardIndexOf[_metaCoinAddress][_account] = rewardIndex[_metaCoinAddress];
    }

    /// @notice Stakes a specified amount of tokens
    /// @param _metaCoinAddress The token address to stake
    /// @param _amount The amount of tokens to stake
    function stake(address _metaCoinAddress, uint256 _amount) external {
        if (!whitelistedStakingTokens[_metaCoinAddress]) revert TokenNotWhitelisted();

        _updateRewards(_metaCoinAddress, msg.sender);
        balanceOf[_metaCoinAddress][msg.sender] += _amount;
        totalSupplies[_metaCoinAddress] += _amount;

        emit Staked(_metaCoinAddress, _amount);
        IERC20Metadata(_metaCoinAddress).safeTransferFrom(msg.sender, address(this), _amount);
    }

    /// @notice Unstakes a specified amount of tokens
    /// @param _metaCoinAddress The token address to unstake
    /// @param _amount The amount of tokens to unstake
    function unstake(address _metaCoinAddress, uint256 _amount) external {
        if (!whitelistedStakingTokens[_metaCoinAddress]) revert TokenNotWhitelisted();

        _updateRewards(_metaCoinAddress, msg.sender);
        balanceOf[_metaCoinAddress][msg.sender] -= _amount;
        totalSupplies[_metaCoinAddress] -= _amount;

        emit Unstaked(_metaCoinAddress, _amount);
        IERC20Metadata(_metaCoinAddress).safeTransfer(msg.sender, _amount);
    }

    /// @notice Claims rewards for multiple token addresses
    /// @param _metaCoinAddresses The array of token addresses to claim rewards for
    /// @return _rewards An array containing the reward amounts for each token
    function claim(address[] calldata _metaCoinAddresses) external returns (uint256[] memory _rewards) {
        _rewards = new uint256[](_metaCoinAddresses.length);

        for (uint256 i = 0; i < _metaCoinAddresses.length; ++i) {
            _updateRewards(_metaCoinAddresses[i], msg.sender);

            uint256 _reward = earned[_metaCoinAddresses[i]][msg.sender];
            earned[_metaCoinAddresses[i]][msg.sender] = 0;

            _rewards[i] = _reward;
            emit Claimed(_metaCoinAddresses[i], _reward);

            IERC20Metadata(_metaCoinAddresses[i]).safeTransfer(msg.sender, _reward);
        }

        return _rewards;
    }

    /// @notice Sets a new protocol fee recipient
    /// @param _newRecipient The address of the new protocol fee recipient
    function setProtocolFeeRecipient(address _newRecipient) external {
        if (msg.sender != protocolFeeRecipient) revert Unauthorised();
        emit ProtocolFeeRecipientSet(protocolFeeRecipient, _newRecipient);
        protocolFeeRecipient = _newRecipient;
    }

    /// @notice Claims accumulated protocol fees for multiple token addresses
    /// @param _metaCoinAddresses The array of token addresses to claim protocol fees from
    function claimProtocolFees(address[] calldata _metaCoinAddresses) external {
        if (msg.sender != protocolFeeRecipient) revert Unauthorised();
        for (uint256 i; i < _metaCoinAddresses.length; ++i) {
            uint256 _reward = protocolFees[_metaCoinAddresses[i]];
            protocolFees[_metaCoinAddresses[i]] = 0;
            emit ProtocolFeeClaimed(_metaCoinAddresses[i], _reward);
            IERC20Metadata(_metaCoinAddresses[i]).safeTransfer(protocolFeeRecipient, _reward);
        }
    }

    /// @notice Whitelists a token for staking
    /// @param _metaCoinAddress The token address to whitelist
    function whitelistStakingToken(address _metaCoinAddress) external onlyOwner {
        whitelistedStakingTokens[_metaCoinAddress] = true;
        emit WhitelistSet(_metaCoinAddress);
    }
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
