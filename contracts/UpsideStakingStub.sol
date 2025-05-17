// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/*
    The purpose of this contract is to fill in for the staking contract.

    The UpsideProtocol contract requires a staking contract to handle fees.

    This contract can be used in place of a staking contract if the decision is
    not to enable staking just yet.
*/

contract UpsideStakingStub is Ownable {
    address public feeDestinationAddress;

    constructor(address _newOwner) Ownable(_newOwner) {}

    function distributeRewards(address _metaCoinAddress, uint256 _rewardTokenAmount) external {
        // @dev Stub function, transfer the tokens to the destination
        IERC20Metadata(_metaCoinAddress).transferFrom(msg.sender, feeDestinationAddress, _rewardTokenAmount);
    }

    function whitelistStakingToken(address _metaCoinAddress) external {
        // @dev Stub function, we don't need to do anything here
    }

    function setFeeDestinationAddress(address _newDestination) external onlyOwner {
        feeDestinationAddress = _newDestination;
    }
}
